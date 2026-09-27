"""Runtime configuration from environment (no secrets committed)."""

from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path

def _load_env_file() -> None:
    """Load web/backend/.env into os.environ if present (no python-dotenv dep)."""
    path = Path(__file__).resolve().parent / ".env"
    if not path.is_file():
        return
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, val = line.split("=", 1)
        key = key.strip()
        val = val.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = val


_load_env_file()



def _env_bool(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def _env_int(name: str, default: int) -> int:
    raw = os.getenv(name)
    if raw is None or not raw.strip():
        return default
    try:
        return int(raw.strip())
    except ValueError:
        return default


class Settings:
    """App settings loaded once from env."""

    def __init__(self) -> None:
        self.auth_required = _env_bool("AUTH_REQUIRED", True)
        self.auth_secret = (
            os.getenv("CAVIO_AUTH_SECRET")
            or os.getenv("AUTH_SECRET")
            or "dev-only-change-me"
        )
        self.token_ttl_seconds = _env_int("AUTH_TOKEN_TTL_SECONDS", 60 * 60 * 24 * 7)
        self.max_upload_bytes = _env_int("MAX_UPLOAD_BYTES", 20 * 1024 * 1024)
        self.rate_limit_requests = _env_int("RATE_LIMIT_REQUESTS", 30)
        self.rate_limit_window_seconds = _env_int("RATE_LIMIT_WINDOW_SECONDS", 60)
        self.signup_bonus_credits = _env_int("SIGNUP_BONUS_CREDITS", 3)
        self.scan_credit_cost = _env_int("SCAN_CREDIT_COST", 1)
        self.credits_per_pack = _env_int("CREDITS_PER_PACK", 25)
        self.credit_pack_price_cents = _env_int("CREDIT_PACK_PRICE_CENTS", 1999)
        self.stripe_secret_key = (os.getenv("STRIPE_SECRET_KEY") or "").strip()
        self.stripe_publishable_key = (os.getenv("STRIPE_PUBLISHABLE_KEY") or "").strip()
        self.stripe_webhook_secret = (os.getenv("STRIPE_WEBHOOK_SECRET") or "").strip()
        self.stripe_price_id = (os.getenv("STRIPE_PRICE_ID") or "").strip()
        # Recurring subscription prices (month = default; year = Save 20%).
        self.stripe_price_id_starter = (os.getenv("STRIPE_PRICE_ID_STARTER") or "").strip()
        self.stripe_price_id_pro = (os.getenv("STRIPE_PRICE_ID_PRO") or "").strip()
        self.stripe_price_id_clinic = (os.getenv("STRIPE_PRICE_ID_CLINIC") or "").strip()
        self.stripe_price_id_starter_yearly = (
            os.getenv("STRIPE_PRICE_ID_STARTER_YEARLY") or ""
        ).strip()
        self.stripe_price_id_pro_yearly = (
            os.getenv("STRIPE_PRICE_ID_PRO_YEARLY") or ""
        ).strip()
        self.stripe_price_id_clinic_yearly = (
            os.getenv("STRIPE_PRICE_ID_CLINIC_YEARLY") or ""
        ).strip()
        self.checkout_success_url = (
            os.getenv("CHECKOUT_SUCCESS_URL")
            or "http://localhost:5173/settings?credits=success"
        ).strip()
        self.checkout_cancel_url = (
            os.getenv("CHECKOUT_CANCEL_URL")
            or "http://localhost:5173/settings?credits=cancel"
        ).strip()
        self.firebase_project_id = (
            os.getenv("FIREBASE_PROJECT_ID")
            or os.getenv("VITE_FIREBASE_PROJECT_ID")
            or ""
        ).strip()
        self.allow_local_auth = _env_bool("ALLOW_LOCAL_AUTH", True)


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
