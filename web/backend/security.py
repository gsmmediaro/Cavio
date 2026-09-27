"""Auth, rate limits, upload validation, and audit helpers."""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import logging
import re
import threading
import time
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional

from fastapi import HTTPException, Request

from web.backend.config import Settings, get_settings, max_upload_bytes

AUDIT_LOGGER = logging.getLogger("cavio.audit")

TRIAL_CID_RE = re.compile(r"^[A-Za-z0-9_-]{1,64}$")
RESULT_FILE_RE = re.compile(r"^[a-f0-9]{12}\.jpg$")
JWT_UNSAFE = re.compile(r"^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$")

ALLOWED_MIME = {
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/bmp",
    "image/tiff",
    "image/tif",
    "image/webp",
    "application/octet-stream",
}

ALLOWED_SUFFIXES = {
    ".jpg",
    ".jpeg",
    ".png",
    ".bmp",
    ".tif",
    ".tiff",
    ".webp",
}

# Magic prefixes mapped to canonical MIME types.
_MAGIC_PREFIXES: tuple[tuple[bytes, str], ...] = (
    (b"\xff\xd8\xff", "image/jpeg"),
    (b"\x89PNG\r\n\x1a\n", "image/png"),
    (b"BM", "image/bmp"),
    (b"II*\x00", "image/tiff"),
    (b"MM\x00*", "image/tiff"),
)


@dataclass(frozen=True)
class Actor:
    """Authenticated or anonymous caller identity (no PHI)."""

    kind: str
    raw_id: str
    hashed_id: str


@dataclass
class RateDecision:
    """Result of a rate-limit check."""

    allowed: bool
    retry_after_s: int
    remaining: int
    limit: int


class RateLimiter:
    """In-memory sliding-window and UTC-day counters."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._windows: dict[str, list[float]] = defaultdict(list)
        self._days: dict[str, tuple[str, int]] = {}
        self._hits = 0

    def _cleanup_locked(self, now: float) -> None:
        """Drop stale window keys to bound memory."""
        stale = [
            key
            for key, stamps in self._windows.items()
            if not stamps or now - stamps[-1] > 86_400
        ]
        for key in stale:
            self._windows.pop(key, None)
        today = _utc_day()
        stale_days = [
            key for key, (day, _) in self._days.items() if day != today
        ]
        for key in stale_days:
            self._days.pop(key, None)

    def hit_window(
        self,
        key: str,
        limit: int,
        window_s: float,
    ) -> RateDecision:
        """Consume one slot in a sliding window."""
        if limit <= 0:
            return RateDecision(True, 0, 0, limit)
        now = time.time()
        cutoff = now - window_s
        with self._lock:
            self._hits += 1
            if self._hits % 64 == 0:
                self._cleanup_locked(now)
            stamps = [t for t in self._windows[key] if t > cutoff]
            if len(stamps) >= limit:
                self._windows[key] = stamps
                retry = int(max(1, stamps[0] + window_s - now))
                return RateDecision(False, retry, 0, limit)
            stamps.append(now)
            self._windows[key] = stamps
            remaining = max(0, limit - len(stamps))
            return RateDecision(True, 0, remaining, limit)

    def hit_day(self, key: str, limit: int) -> RateDecision:
        """Consume one slot for the current UTC calendar day."""
        if limit <= 0:
            return RateDecision(True, 0, 0, limit)
        today = _utc_day()
        with self._lock:
            day, count = self._days.get(key, (today, 0))
            if day != today:
                count = 0
            if count >= limit:
                self._days[key] = (today, count)
                retry = _seconds_until_utc_midnight()
                return RateDecision(False, retry, 0, limit)
            count += 1
            self._days[key] = (today, count)
            remaining = max(0, limit - count)
            return RateDecision(True, 0, remaining, limit)


_LIMITER = RateLimiter()
_INFER_SEMAPHORE: Optional[threading.BoundedSemaphore] = None
_INFER_SEMAPHORE_SIZE = 0
_INFER_LOCK = threading.Lock()


def get_rate_limiter() -> RateLimiter:
    """Return the process-wide limiter (tests may reset it)."""
    return _LIMITER


def reset_rate_limiter() -> None:
    """Clear in-memory counters (tests only)."""
    global _LIMITER
    _LIMITER = RateLimiter()


def inference_semaphore(settings: Settings | None = None):
    """Return a process-wide inference concurrency cap."""
    global _INFER_SEMAPHORE, _INFER_SEMAPHORE_SIZE
    cfg = settings or get_settings()
    size = max(1, cfg.max_concurrent_inferences)
    with _INFER_LOCK:
        if _INFER_SEMAPHORE is None or _INFER_SEMAPHORE_SIZE != size:
            _INFER_SEMAPHORE = threading.BoundedSemaphore(size)
            _INFER_SEMAPHORE_SIZE = size
        return _INFER_SEMAPHORE


def hash_identifier(value: str, settings: Settings | None = None) -> str:
    """Stable short hash for audit logs (not reversible to PHI)."""
    cfg = settings or get_settings()
    material = f"{cfg.audit_hash_salt}:{value}".encode("utf-8")
    return hashlib.sha256(material).hexdigest()[:16]


def client_ip(request: Request, settings: Settings | None = None) -> str:
    """Best-effort client IP, honoring X-Forwarded-For when trusted."""
    cfg = settings or get_settings()
    if cfg.trust_x_forwarded_for:
        forwarded = request.headers.get("x-forwarded-for", "")
        first = forwarded.split(",")[0].strip()
        if first:
            return first
        real_ip = request.headers.get("x-real-ip", "").strip()
        if real_ip:
            return real_ip
    if request.client and request.client.host:
        return request.client.host
    return "unknown"


def _b64url_encode(data: bytes) -> str:
    """URL-safe base64 without padding."""
    return base64.urlsafe_b64encode(data).decode("ascii").rstrip("=")


def _b64url_decode(value: str) -> bytes:
    """Decode URL-safe base64, adding padding if needed."""
    padding = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(value + padding)


def mint_trial_token(
    clinic_id: str,
    ttl_days: int = 30,
    secret: str | None = None,
    now: int | None = None,
) -> str:
    """Create a signed trial token for a clinic."""
    if not TRIAL_CID_RE.fullmatch(clinic_id):
        raise ValueError(
            "clinic_id must be 1-64 letters, digits, _ or -"
        )
    if secret is not None:
        cfg_secret = secret
    else:
        cfg_secret = get_settings().trial_token_secret
    if not cfg_secret:
        raise ValueError("TRIAL_TOKEN_SECRET is not configured")
    issued = int(now if now is not None else time.time())
    exp = issued + max(1, ttl_days) * 86_400
    payload = {"v": 1, "cid": clinic_id, "exp": exp}
    body = _b64url_encode(
        json.dumps(payload, separators=(",", ":")).encode("utf-8")
    )
    sig = hmac.new(
        cfg_secret.encode("utf-8"),
        body.encode("ascii"),
        hashlib.sha256,
    ).hexdigest()
    return f"{body}.{sig}"


def verify_trial_token(
    token: str,
    secret: str | None = None,
    now: int | None = None,
) -> str:
    """Return clinic_id if the trial token is valid."""
    if secret is not None:
        cfg_secret = secret
    else:
        cfg_secret = get_settings().trial_token_secret
    if not cfg_secret:
        raise HTTPException(
            status_code=401,
            detail="Trial tokens are not enabled",
        )
    parts = token.split(".")
    if len(parts) != 2:
        raise HTTPException(status_code=401, detail="Invalid trial token")
    body, sig = parts
    expected = hmac.new(
        cfg_secret.encode("utf-8"),
        body.encode("ascii"),
        hashlib.sha256,
    ).hexdigest()
    if not hmac.compare_digest(expected, sig):
        raise HTTPException(status_code=401, detail="Invalid trial token")
    try:
        payload = json.loads(_b64url_decode(body))
    except (ValueError, json.JSONDecodeError) as exc:
        raise HTTPException(
            status_code=401,
            detail="Invalid trial token",
        ) from exc
    clinic_id = str(payload.get("cid", ""))
    exp = payload.get("exp")
    if not TRIAL_CID_RE.fullmatch(clinic_id):
        raise HTTPException(status_code=401, detail="Invalid trial token")
    try:
        exp_ts = int(exp)
    except (TypeError, ValueError) as exc:
        raise HTTPException(
            status_code=401,
            detail="Invalid trial token",
        ) from exc
    current = int(now if now is not None else time.time())
    if current >= exp_ts:
        raise HTTPException(status_code=401, detail="Trial token expired")
    return clinic_id


def _match_api_key(provided: str, settings: Settings) -> bool:
    """Compare provided key against configured API keys via digests."""
    if not provided or not settings.api_keys:
        return False
    matched = False
    provided_digest = hashlib.sha256(provided.encode("utf-8")).digest()
    for key in settings.api_keys:
        key_digest = hashlib.sha256(key.encode("utf-8")).digest()
        if hmac.compare_digest(provided_digest, key_digest):
            matched = True
    return matched


def _bearer_subject(token: str) -> str | None:
    """Extract JWT sub/user_id without cryptographic verify.

    Used only as a rate-limit / audit key. Privilege is never granted
    from an unverified bearer token.
    """
    if not JWT_UNSAFE.fullmatch(token):
        return hash_identifier(f"bearer:{token}")
    try:
        payload = json.loads(_b64url_decode(token.split(".")[1]))
    except (ValueError, json.JSONDecodeError):
        return hash_identifier(f"bearer:{token}")
    for field in ("user_id", "sub", "uid"):
        value = payload.get(field)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return hash_identifier(f"bearer:{token}")


def resolve_actor(request: Request, settings: Settings | None = None) -> Actor:
    """Identify the caller from API key, trial token, bearer, or IP."""
    cfg = settings or get_settings()
    api_key = (request.headers.get("x-api-key") or "").strip()
    if api_key and cfg.api_keys:
        if not _match_api_key(api_key, cfg):
            raise HTTPException(status_code=401, detail="Invalid API key")
        return Actor("apikey", api_key, hash_identifier(api_key, cfg))

    trial = (request.headers.get("x-trial-token") or "").strip()
    if trial and cfg.trial_token_secret:
        clinic_id = verify_trial_token(trial, cfg.trial_token_secret)
        return Actor("trial", clinic_id, hash_identifier(clinic_id, cfg))

    auth = (request.headers.get("authorization") or "").strip()
    if auth.lower().startswith("bearer "):
        token = auth[7:].strip()
        if token:
            subject = _bearer_subject(token) or "unknown"
            return Actor("user", subject, hash_identifier(subject, cfg))

    ip = client_ip(request, cfg)
    return Actor("ip", ip, hash_identifier(ip, cfg))


def enforce_auth_if_required(
    actor: Actor,
    settings: Settings | None = None,
) -> None:
    """Reject anonymous callers when REQUIRE_AUTH is enabled."""
    cfg = settings or get_settings()
    if not cfg.require_auth:
        return
    if actor.kind not in {"apikey", "trial"}:
        raise HTTPException(
            status_code=401,
            detail="Authentication required",
        )


def _raise_rate_limited(decision: RateDecision, message: str) -> None:
    """Raise a 429 with Retry-After metadata."""
    raise HTTPException(
        status_code=429,
        detail=message,
        headers={"Retry-After": str(max(1, decision.retry_after_s))},
    )


def enforce_analyze_limits(
    actor: Actor,
    ip: str,
    settings: Settings | None = None,
    limiter: RateLimiter | None = None,
) -> RateDecision:
    """Apply IP burst plus identity daily/minute quotas."""
    cfg = settings or get_settings()
    lim = limiter or get_rate_limiter()
    ip_hash = hash_identifier(ip, cfg)

    burst: RateDecision | None = None
    ip_day: RateDecision | None = None
    if actor.kind == "ip":
        burst = lim.hit_window(
            f"analyze:ip:min:{ip_hash}",
            cfg.rate_limit_ip_per_minute,
            60,
        )
        if not burst.allowed:
            _raise_rate_limited(
                burst,
                "Too many analyses from this network. Try again shortly.",
            )
        ip_day = lim.hit_day(
            f"analyze:ip:day:{ip_hash}",
            cfg.rate_limit_ip_per_day,
        )
        if not ip_day.allowed:
            _raise_rate_limited(
                ip_day,
                "Daily analysis limit reached for this network.",
            )

    if actor.kind == "trial":
        day = lim.hit_day(
            f"analyze:trial:day:{actor.hashed_id}",
            cfg.trial_scans_per_day,
        )
        if not day.allowed:
            _raise_rate_limited(
                day,
                "Trial clinic daily scan limit reached.",
            )
        return day

    if actor.kind in {"apikey", "user"}:
        minute = lim.hit_window(
            f"analyze:{actor.kind}:min:{actor.hashed_id}",
            cfg.rate_limit_user_per_minute,
            60,
        )
        if not minute.allowed:
            _raise_rate_limited(
                minute,
                "Too many analyses. Try again shortly.",
            )
        day = lim.hit_day(
            f"analyze:{actor.kind}:day:{actor.hashed_id}",
            cfg.rate_limit_user_per_day,
        )
        if not day.allowed:
            _raise_rate_limited(
                day,
                "Daily analysis limit reached.",
            )
        return day

    return ip_day or burst


def enforce_models_limits(
    ip: str,
    settings: Settings | None = None,
    limiter: RateLimiter | None = None,
) -> None:
    """Burst-protect the public models listing endpoint."""
    cfg = settings or get_settings()
    lim = limiter or get_rate_limiter()
    ip_hash = hash_identifier(ip, cfg)
    decision = lim.hit_window(
        f"models:ip:min:{ip_hash}",
        cfg.rate_limit_models_per_minute,
        60,
    )
    if not decision.allowed:
        _raise_rate_limited(
            decision,
            "Too many requests. Try again shortly.",
        )


def sniff_image_mime(data: bytes) -> str | None:
    """Return a canonical image MIME from magic bytes, or None."""
    if not data:
        return None
    for prefix, mime in _MAGIC_PREFIXES:
        if data.startswith(prefix):
            return mime
    if data.startswith(b"RIFF") and data[8:12] == b"WEBP":
        return "image/webp"
    return None


def sanitize_upload_filename(filename: str | None) -> str:
    """Return a basename-only filename, rejecting traversal."""
    raw = (filename or "upload").replace("\\", "/")
    name = Path(raw).name
    if not name or name in {".", ".."}:
        return "upload"
    return name


def validate_upload_meta(
    filename: str | None,
    content_type: str | None,
) -> str:
    """Validate declared type/name before reading the body."""
    safe_name = sanitize_upload_filename(filename)
    suffix = Path(safe_name).suffix.lower()
    if suffix and suffix not in ALLOWED_SUFFIXES:
        raise HTTPException(
            status_code=415,
            detail="Unsupported file type. Upload a JPEG, PNG, BMP, or TIFF.",
        )
    declared = (content_type or "").split(";")[0].strip().lower()
    if declared and declared not in ALLOWED_MIME:
        raise HTTPException(
            status_code=415,
            detail="Unsupported media type. Upload a radiograph image.",
        )
    return safe_name


def validate_image_bytes(data: bytes, settings: Settings | None = None) -> str:
    """Reject oversized or non-image payloads via magic bytes."""
    cfg = settings or get_settings()
    if not data:
        raise HTTPException(status_code=400, detail="Empty upload")
    if len(data) > max_upload_bytes(cfg):
        raise HTTPException(
            status_code=413,
            detail="File exceeds maximum upload size",
        )
    mime = sniff_image_mime(data)
    if mime is None:
        raise HTTPException(
            status_code=415,
            detail="File is not a recognized image",
        )
    return mime


def validate_image_dimensions(
    width: int,
    height: int,
    settings: Settings | None = None,
) -> None:
    """Reject images outside configured pixel bounds."""
    cfg = settings or get_settings()
    if width <= 0 or height <= 0:
        raise HTTPException(status_code=400, detail="Invalid image")
    longest = max(width, height)
    shortest = min(width, height)
    if shortest < cfg.min_image_px:
        raise HTTPException(
            status_code=400,
            detail="Image is too small to analyze",
        )
    if longest > cfg.max_image_px:
        raise HTTPException(
            status_code=400,
            detail="Image dimensions exceed the allowed maximum",
        )


def safe_result_filename(filename: str) -> str:
    """Accept only generated result names (blocks path traversal)."""
    name = Path(filename).name
    if not RESULT_FILE_RE.fullmatch(name):
        raise HTTPException(status_code=404, detail="Not found")
    return name


def resolve_under_dir(root: Path, filename: str) -> Path:
    """Resolve filename under root; reject escapes."""
    safe = safe_result_filename(filename)
    root_resolved = root.resolve()
    candidate = (root_resolved / safe).resolve()
    try:
        candidate.relative_to(root_resolved)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail="Not found") from exc
    return candidate


def purge_expired_results(root: Path, ttl_hours: int) -> int:
    """Delete annotated results older than TTL. Returns count removed."""
    if ttl_hours <= 0 or not root.is_dir():
        return 0
    cutoff = time.time() - ttl_hours * 3600
    removed = 0
    for path in root.iterdir():
        if not path.is_file():
            continue
        if not RESULT_FILE_RE.fullmatch(path.name):
            continue
        try:
            if path.stat().st_mtime < cutoff:
                path.unlink()
                removed += 1
        except OSError as exc:
            logging.getLogger(__name__).warning(
                "Could not remove expired result %s: %s",
                path.name,
                exc,
            )
    return removed


def audit_analyze(
    request_id: str,
    actor: Actor,
    ip: str,
    status: str,
    extra: dict | None = None,
    settings: Settings | None = None,
) -> None:
    """Log an analyze event with hashed identifiers only."""
    cfg = settings or get_settings()
    parts = [
        f"event=analyze",
        f"request_id={request_id}",
        f"actor={actor.kind}",
        f"actor_hash={actor.hashed_id}",
        f"ip_hash={hash_identifier(ip, cfg)}",
        f"status={status}",
    ]
    if extra:
        for key, value in extra.items():
            if value is None:
                continue
            parts.append(f"{key}={value}")
    AUDIT_LOGGER.info(" ".join(parts))


def _utc_day() -> str:
    """Return YYYY-MM-DD in UTC."""
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def _seconds_until_utc_midnight() -> int:
    """Seconds remaining in the current UTC day."""
    now = datetime.now(timezone.utc)
    tomorrow = (now + timedelta(days=1)).replace(
        hour=0,
        minute=0,
        second=0,
        microsecond=0,
    )
    return max(1, int((tomorrow - now).total_seconds()))
