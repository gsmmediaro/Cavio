"""Environment-driven security and inference limits."""

import os
from dataclasses import dataclass
from functools import lru_cache


def _split_csv(value: str) -> list[str]:
    """Split a comma-separated env value into stripped items."""
    return [item.strip() for item in value.split(",") if item.strip()]


def _env_int(name: str, default: int) -> int:
    """Parse an integer env var, falling back to default."""
    raw = os.getenv(name)
    if raw is None or not raw.strip():
        return default
    try:
        return int(raw.strip())
    except ValueError:
        return default


def _env_float(name: str, default: float) -> float:
    """Parse a float env var, falling back to default."""
    raw = os.getenv(name)
    if raw is None or not raw.strip():
        return default
    try:
        return float(raw.strip())
    except ValueError:
        return default


def _env_bool(name: str, default: bool) -> bool:
    """Parse a boolean env var (1/true/yes/on)."""
    raw = os.getenv(name)
    if raw is None or not raw.strip():
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


@dataclass(frozen=True)
class Settings:
    """Production-safe defaults for a 5-scan clinic pilot."""

    cors_origins: tuple[str, ...]
    cors_origin_regex: str | None
    max_upload_mb: int
    max_image_px: int
    min_image_px: int
    inference_timeout_s: float
    max_concurrent_inferences: int
    trial_scans_per_day: int
    rate_limit_ip_per_minute: int
    rate_limit_ip_per_day: int
    rate_limit_user_per_minute: int
    rate_limit_user_per_day: int
    rate_limit_models_per_minute: int
    api_keys: tuple[str, ...]
    trial_token_secret: str
    require_auth: bool
    trust_x_forwarded_for: bool
    audit_hash_salt: str
    results_ttl_hours: int
    request_size_overhead_kb: int


def _default_origins() -> tuple[str, ...]:
    """Localhost Vite origins, plus optional frontend URLs."""
    origins = _split_csv(
        os.getenv(
            "CORS_ORIGINS",
            "http://localhost:5173,http://127.0.0.1:5173",
        )
    )
    for key in ("FRONTEND_ORIGIN", "FRONTEND_URL"):
        value = (os.getenv(key) or "").strip().rstrip("/")
        if value and value not in origins:
            origins.append(value)
    return tuple(origins)


def _origin_regex() -> str | None:
    """Optional origin regex. Empty disables wildcard Vercel matching."""
    if "CORS_ORIGIN_REGEX" not in os.environ:
        return None
    raw = os.getenv("CORS_ORIGIN_REGEX", "").strip()
    return raw or None


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Load settings from the environment (cached)."""
    secret = os.getenv("TRIAL_TOKEN_SECRET", "").strip()
    salt = os.getenv("AUDIT_HASH_SALT", "").strip() or secret
    if not salt:
        salt = "local-dev-audit-salt"
    return Settings(
        cors_origins=_default_origins(),
        cors_origin_regex=_origin_regex(),
        max_upload_mb=_env_int("MAX_UPLOAD_MB", 15),
        max_image_px=_env_int("MAX_IMAGE_PX", 8192),
        min_image_px=_env_int("MIN_IMAGE_PX", 32),
        inference_timeout_s=_env_float("INFERENCE_TIMEOUT_S", 45),
        max_concurrent_inferences=_env_int(
            "MAX_CONCURRENT_INFERENCES",
            2,
        ),
        trial_scans_per_day=_env_int("TRIAL_SCANS_PER_DAY", 5),
        rate_limit_ip_per_minute=_env_int(
            "RATE_LIMIT_ANALYZE_PER_IP_MINUTE",
            3,
        ),
        rate_limit_ip_per_day=_env_int(
            "RATE_LIMIT_ANALYZE_PER_IP_DAY",
            10,
        ),
        rate_limit_user_per_minute=_env_int(
            "RATE_LIMIT_ANALYZE_PER_USER_MINUTE",
            5,
        ),
        rate_limit_user_per_day=_env_int(
            "RATE_LIMIT_ANALYZE_PER_USER_DAY",
            50,
        ),
        rate_limit_models_per_minute=_env_int(
            "RATE_LIMIT_MODELS_PER_IP_MINUTE",
            30,
        ),
        api_keys=tuple(_split_csv(os.getenv("API_KEYS", ""))),
        trial_token_secret=secret,
        require_auth=_env_bool("REQUIRE_AUTH", False),
        trust_x_forwarded_for=_env_bool(
            "TRUST_X_FORWARDED_FOR",
            True,
        ),
        audit_hash_salt=salt,
        results_ttl_hours=_env_int("RESULTS_TTL_HOURS", 24),
        request_size_overhead_kb=_env_int(
            "REQUEST_SIZE_OVERHEAD_KB",
            64,
        ),
    )


def max_upload_bytes(settings: Settings | None = None) -> int:
    """Return the configured maximum upload size in bytes."""
    cfg = settings or get_settings()
    return max(1, cfg.max_upload_mb) * 1024 * 1024


def max_request_bytes(settings: Settings | None = None) -> int:
    """Return Content-Length cap including multipart overhead."""
    cfg = settings or get_settings()
    overhead = max(0, cfg.request_size_overhead_kb) * 1024
    return max_upload_bytes(cfg) + overhead
