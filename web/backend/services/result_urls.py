"""Short-lived HMAC-signed URLs for /static/results assets."""

from __future__ import annotations

import hashlib
import hmac
import time
from urllib.parse import urlencode

from web.backend.config import get_settings

DEFAULT_TTL_SECONDS = 15 * 60


def sign_result_filename(filename: str, ttl_seconds: int = DEFAULT_TTL_SECONDS) -> tuple[str, int]:
    settings = get_settings()
    exp = int(time.time()) + int(ttl_seconds)
    msg = f"{filename}:{exp}".encode("utf-8")
    sig = hmac.new(settings.auth_secret.encode("utf-8"), msg, hashlib.sha256).hexdigest()
    return sig, exp


def verify_result_signature(filename: str, sig: str, exp: str) -> bool:
    settings = get_settings()
    if not sig or not exp:
        return False
    try:
        exp_i = int(exp)
    except (TypeError, ValueError):
        return False
    if exp_i < int(time.time()):
        return False
    msg = f"{filename}:{exp_i}".encode("utf-8")
    expected = hmac.new(settings.auth_secret.encode("utf-8"), msg, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, sig)


def append_result_signature(url: str, filename: str) -> str:
    sig, exp = sign_result_filename(filename)
    sep = "&" if "?" in url else "?"
    return f"{url}{sep}{urlencode({'sig': sig, 'exp': str(exp)})}"
