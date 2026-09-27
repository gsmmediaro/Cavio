"""Authentication helpers: local email/password JWT + optional Firebase ID tokens."""

from __future__ import annotations

import hashlib
import hmac
import logging
import secrets
import time
from dataclasses import dataclass
from typing import Optional
from urllib.request import urlopen

import jwt
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from web.backend.config import get_settings
from web.backend.services import credits as credits_service

logger = logging.getLogger(__name__)

_bearer = HTTPBearer(auto_error=False)
_PBKDF2_ITERATIONS = 210_000
_FIREBASE_CERTS_URL = (
    "https://www.googleapis.com/robot/v1/metadata/x509/"
    "securetoken@system.gserviceaccount.com"
)
_firebase_certs_cache: dict[str, object] = {"fetched_at": 0.0, "certs": {}}


@dataclass
class AuthUser:
    uid: str
    email: str
    provider: str  # local | firebase


def hash_password(password: str, salt: Optional[str] = None) -> str:
    """Hash password with PBKDF2-HMAC-SHA256. Returns salt$hashhex."""
    if salt is None:
        salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        _PBKDF2_ITERATIONS,
    )
    return f"{salt}${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        salt, _ = stored.split("$", 1)
    except ValueError:
        return False
    candidate = hash_password(password, salt=salt)
    return hmac.compare_digest(candidate, stored)


def issue_local_token(uid: str, email: str) -> str:
    settings = get_settings()
    now = int(time.time())
    payload = {
        "sub": uid,
        "email": email,
        "provider": "local",
        "iat": now,
        "exp": now + settings.token_ttl_seconds,
    }
    return jwt.encode(payload, settings.auth_secret, algorithm="HS256")


def _decode_local_token(token: str) -> AuthUser:
    settings = get_settings()
    try:
        payload = jwt.decode(token, settings.auth_secret, algorithms=["HS256"])
    except jwt.PyJWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        ) from exc
    uid = str(payload.get("sub") or "")
    email = str(payload.get("email") or "")
    if not uid:
        raise HTTPException(status_code=401, detail="Invalid token subject")
    return AuthUser(uid=uid, email=email, provider="local")


def _get_firebase_certs() -> dict:
    now = time.time()
    if now - float(_firebase_certs_cache["fetched_at"]) < 3600 and _firebase_certs_cache["certs"]:
        return _firebase_certs_cache["certs"]  # type: ignore[return-value]
    try:
        with urlopen(_FIREBASE_CERTS_URL, timeout=5) as resp:
            import json

            certs = json.loads(resp.read().decode("utf-8"))
        _firebase_certs_cache["certs"] = certs
        _firebase_certs_cache["fetched_at"] = now
        return certs
    except Exception as exc:
        logger.warning("Could not refresh Firebase certs: %s", exc)
        return _firebase_certs_cache["certs"]  # type: ignore[return-value]


def _decode_firebase_token(token: str) -> AuthUser:
    settings = get_settings()
    project_id = settings.firebase_project_id
    if not project_id:
        raise HTTPException(
            status_code=401,
            detail="Firebase auth not configured on server",
        )
    certs = _get_firebase_certs()
    if not certs:
        raise HTTPException(status_code=401, detail="Firebase certs unavailable")

    # Fail fast on project mismatch before signature work — clearer than a
    # generic "Invalid Firebase token" when Railway/Pages env diverge.
    try:
        unverified = jwt.decode(token, options={"verify_signature": False})
    except jwt.PyJWTError as exc:
        raise HTTPException(status_code=401, detail="Malformed Firebase token") from exc
    token_aud = str(unverified.get("aud") or "")
    if token_aud and token_aud != project_id:
        logger.warning(
            "Firebase project mismatch: token aud=%s server=%s",
            token_aud,
            project_id,
        )
        raise HTTPException(
            status_code=401,
            detail=(
                f"Firebase project mismatch (token aud={token_aud}, "
                f"server={project_id})"
            ),
        )

    from cryptography.x509 import load_pem_x509_certificate

    last_error: Exception | None = None
    header = jwt.get_unverified_header(token)
    preferred_kid = str(header.get("kid") or "")
    ordered = []
    if preferred_kid and preferred_kid in certs:
        ordered.append((preferred_kid, certs[preferred_kid]))
    ordered.extend((k, v) for k, v in certs.items() if k != preferred_kid)

    for _kid, cert_pem in ordered:
        try:
            if isinstance(cert_pem, str):
                cert_pem_bytes = cert_pem.encode("utf-8")
            else:
                cert_pem_bytes = cert_pem
            public_key = load_pem_x509_certificate(cert_pem_bytes).public_key()
            payload = jwt.decode(
                token,
                public_key,
                algorithms=["RS256"],
                audience=project_id,
                issuer=f"https://securetoken.google.com/{project_id}",
                leeway=60,
            )
            uid = str(payload.get("user_id") or payload.get("sub") or "")
            email = str(payload.get("email") or "")
            if not uid:
                raise HTTPException(status_code=401, detail="Invalid Firebase token")
            return AuthUser(uid=uid, email=email, provider="firebase")
        except jwt.PyJWTError as exc:
            last_error = exc
            continue
        except ValueError as exc:
            last_error = exc
            continue
    if last_error is not None:
        logger.warning("Firebase token verify failed: %s", last_error)
    raise HTTPException(
        status_code=401,
        detail="Invalid Firebase token",
    ) from last_error


def decode_bearer_token(token: str) -> AuthUser:
    """Decode local HS256 JWT first; fall back to Firebase ID token."""
    try:
        header = jwt.get_unverified_header(token)
    except jwt.PyJWTError as exc:
        raise HTTPException(status_code=401, detail="Malformed token") from exc

    alg = header.get("alg")
    if alg == "HS256":
        return _decode_local_token(token)
    return _decode_firebase_token(token)


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
) -> AuthUser:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )
    user = decode_bearer_token(credentials.credentials)
    credits_service.ensure_user(user.uid, user.email, user.provider)
    return user


async def get_optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
) -> Optional[AuthUser]:
    if credentials is None or credentials.scheme.lower() != "bearer":
        return None
    try:
        user = decode_bearer_token(credentials.credentials)
        credits_service.ensure_user(user.uid, user.email, user.provider)
        return user
    except HTTPException:
        return None


async def require_user_if_auth_required(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
) -> Optional[AuthUser]:
    settings = get_settings()
    if not settings.auth_required:
        if credentials and credentials.scheme.lower() == "bearer":
            try:
                return decode_bearer_token(credentials.credentials)
            except HTTPException:
                return None
        return None
    return await get_current_user(credentials)
