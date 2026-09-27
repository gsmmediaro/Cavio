"""Unit tests for inference hardening helpers."""

import os
import tempfile
import unittest
from dataclasses import replace
from pathlib import Path

from fastapi import HTTPException

from web.backend.config import get_settings
from web.backend.security import (
    Actor,
    RateLimiter,
    enforce_analyze_limits,
    enforce_auth_if_required,
    hash_identifier,
    mint_trial_token,
    reset_rate_limiter,
    resolve_under_dir,
    safe_result_filename,
    sanitize_upload_filename,
    sniff_image_mime,
    validate_image_bytes,
    validate_image_dimensions,
    validate_upload_meta,
    verify_trial_token,
)
from web.backend.services import inference


PNG_1X1 = (
    b"\x89PNG\r\n\x1a\n"
    b"\x00\x00\x00\rIHDR"
    b"\x00\x00\x00\x01\x00\x00\x00\x01"
    b"\x08\x02\x00\x00\x00\x90wS\xde"
    b"\x00\x00\x00\x0cIDATx\x9cc\xf8\x0f\x00\x00\x01\x01\x00\x05"
    b"\x18\xd8N\x00\x00\x00\x00IEND\xaeB`\x82"
)

JPEG_MAGIC = b"\xff\xd8\xff\xe0" + b"\x00" * 16


class MagicAndUploadTests(unittest.TestCase):
    """MIME sniffing and upload metadata checks."""

    def test_sniff_png_and_jpeg(self):
        self.assertEqual(sniff_image_mime(PNG_1X1), "image/png")
        self.assertEqual(sniff_image_mime(JPEG_MAGIC), "image/jpeg")
        self.assertIsNone(sniff_image_mime(b"%PDF-1.4"))
        self.assertIsNone(sniff_image_mime(b"<svg></svg>"))

    def test_validate_image_bytes_rejects_non_image(self):
        with self.assertRaises(HTTPException) as ctx:
            validate_image_bytes(b"not-an-image")
        self.assertEqual(ctx.exception.status_code, 415)

    def test_validate_image_bytes_accepts_png(self):
        self.assertEqual(validate_image_bytes(PNG_1X1), "image/png")

    def test_upload_meta_rejects_exe(self):
        with self.assertRaises(HTTPException) as ctx:
            validate_upload_meta("payload.exe", "application/octet-stream")
        self.assertEqual(ctx.exception.status_code, 415)

    def test_upload_meta_strips_paths(self):
        name = validate_upload_meta(
            "../../etc/passwd.jpg",
            "image/jpeg",
        )
        self.assertEqual(name, "passwd.jpg")

    def test_sanitize_upload_filename(self):
        self.assertEqual(
            sanitize_upload_filename("..\\..\\secret.png"),
            "secret.png",
        )
        self.assertEqual(sanitize_upload_filename(".."), "upload")


class DimensionTests(unittest.TestCase):
    """Pixel bounds."""

    def test_too_small(self):
        with self.assertRaises(HTTPException) as ctx:
            validate_image_dimensions(8, 8)
        self.assertEqual(ctx.exception.status_code, 400)

    def test_too_large(self):
        with self.assertRaises(HTTPException) as ctx:
            validate_image_dimensions(20_000, 400)
        self.assertEqual(ctx.exception.status_code, 400)

    def test_ok(self):
        validate_image_dimensions(1024, 768)


class ResultPathTests(unittest.TestCase):
    """Static result path traversal."""

    def test_safe_name_accepts_generated(self):
        self.assertEqual(
            safe_result_filename("deadbeefcafe.jpg"),
            "deadbeefcafe.jpg",
        )

    def test_safe_name_rejects_traversal(self):
        for name in (
            "../secret.jpg",
            "deadbeefcafe.png",
            "abc.jpg",
            "..",
            "deadbeefcafe.jpg/../x",
        ):
            with self.assertRaises(HTTPException):
                safe_result_filename(name)

    def test_resolve_under_dir(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            target = root / "deadbeefcafe.jpg"
            target.write_bytes(b"x")
            resolved = resolve_under_dir(root, "deadbeefcafe.jpg")
            self.assertEqual(resolved, target.resolve())
            # Parent segments are discarded; only the basename is used.
            same = resolve_under_dir(root, "../deadbeefcafe.jpg")
            self.assertEqual(same, target.resolve())
            with self.assertRaises(HTTPException):
                resolve_under_dir(root, "../passwd.txt")


class TrialTokenTests(unittest.TestCase):
    """Signed trial tokens."""

    def test_roundtrip(self):
        token = mint_trial_token(
            "clinic-nord",
            ttl_days=2,
            secret="unit-test-secret",
            now=1_700_000_000,
        )
        clinic = verify_trial_token(
            token,
            secret="unit-test-secret",
            now=1_700_000_000,
        )
        self.assertEqual(clinic, "clinic-nord")

    def test_bad_signature(self):
        token = mint_trial_token(
            "clinic-nord",
            secret="unit-test-secret",
        )
        with self.assertRaises(HTTPException) as ctx:
            verify_trial_token(token, secret="other-secret")
        self.assertEqual(ctx.exception.status_code, 401)

    def test_expired(self):
        token = mint_trial_token(
            "clinic-nord",
            ttl_days=1,
            secret="unit-test-secret",
            now=1_000,
        )
        with self.assertRaises(HTTPException) as ctx:
            verify_trial_token(
                token,
                secret="unit-test-secret",
                now=1_000 + 86_401,
            )
        self.assertEqual(ctx.exception.status_code, 401)

    def test_invalid_clinic_id(self):
        with self.assertRaises(ValueError):
            mint_trial_token("clinic/../x", secret="s")


class RateLimitTests(unittest.TestCase):
    """In-memory quotas."""

    def setUp(self):
        reset_rate_limiter()
        get_settings.cache_clear()
        os.environ["TRIAL_SCANS_PER_DAY"] = "5"
        os.environ["RATE_LIMIT_ANALYZE_PER_IP_MINUTE"] = "20"
        os.environ["RATE_LIMIT_ANALYZE_PER_IP_DAY"] = "10"
        get_settings.cache_clear()

    def tearDown(self):
        reset_rate_limiter()
        get_settings.cache_clear()
        for key in (
            "TRIAL_SCANS_PER_DAY",
            "RATE_LIMIT_ANALYZE_PER_IP_MINUTE",
            "RATE_LIMIT_ANALYZE_PER_IP_DAY",
        ):
            os.environ.pop(key, None)
        get_settings.cache_clear()

    def test_trial_five_per_day(self):
        limiter = RateLimiter()
        actor = Actor("trial", "clinic-a", hash_identifier("clinic-a"))
        settings = get_settings()
        for _ in range(5):
            enforce_analyze_limits(
                actor,
                "203.0.113.10",
                settings,
                limiter,
            )
        with self.assertRaises(HTTPException) as ctx:
            enforce_analyze_limits(
                actor,
                "203.0.113.10",
                settings,
                limiter,
            )
        self.assertEqual(ctx.exception.status_code, 429)

    def test_ip_burst(self):
        os.environ["RATE_LIMIT_ANALYZE_PER_IP_MINUTE"] = "2"
        get_settings.cache_clear()
        limiter = RateLimiter()
        actor = Actor("ip", "203.0.113.9", hash_identifier("203.0.113.9"))
        settings = get_settings()
        enforce_analyze_limits(actor, "203.0.113.9", settings, limiter)
        enforce_analyze_limits(actor, "203.0.113.9", settings, limiter)
        with self.assertRaises(HTTPException) as ctx:
            enforce_analyze_limits(actor, "203.0.113.9", settings, limiter)
        self.assertEqual(ctx.exception.status_code, 429)


class ModelRefTests(unittest.TestCase):
    """Model ids must not accept arbitrary paths."""

    def test_auto(self):
        self.assertEqual(inference.resolve_model_ref("auto"), "auto")
        self.assertEqual(inference.resolve_model_ref("AUTO"), "auto")

    def test_rejects_system_path(self):
        self.assertIsNone(inference.resolve_model_ref("/etc/passwd"))
        self.assertIsNone(inference.resolve_model_ref("../../weights.pt"))

    def test_public_id_from_weights_path(self):
        fake = (
            "/app/runs/detect/runs/dental/pano_gpu2/weights/best.pt"
        )
        self.assertEqual(inference.model_public_id(fake), "pano_gpu2")


class SettingsTests(unittest.TestCase):
    """Env defaults stay localhost-safe."""

    def test_default_cors_includes_localhost(self):
        for key in (
            "CORS_ORIGINS",
            "CORS_ORIGIN_REGEX",
            "FRONTEND_ORIGIN",
            "FRONTEND_URL",
            "REQUIRE_AUTH",
            "TRIAL_SCANS_PER_DAY",
            "MAX_UPLOAD_MB",
        ):
            os.environ.pop(key, None)
        get_settings.cache_clear()
        settings = get_settings()
        self.assertIn("http://localhost:5173", settings.cors_origins)
        self.assertIsNone(settings.cors_origin_regex)
        self.assertFalse(settings.require_auth)
        self.assertEqual(settings.trial_scans_per_day, 5)
        self.assertEqual(settings.max_upload_mb, 15)

    def test_require_auth_rejects_ip_and_unverified_bearer(self):
        settings = replace(get_settings(), require_auth=True)
        ip_actor = Actor("ip", "1.2.3.4", "abcd")
        user_actor = Actor("user", "uid", "efgh")
        with self.assertRaises(HTTPException) as ctx:
            enforce_auth_if_required(ip_actor, settings)
        self.assertEqual(ctx.exception.status_code, 401)
        with self.assertRaises(HTTPException):
            enforce_auth_if_required(user_actor, settings)
        enforce_auth_if_required(Actor("trial", "c1", "h1"), settings)
        enforce_auth_if_required(Actor("apikey", "k", "h2"), settings)


if __name__ == "__main__":
    unittest.main()
