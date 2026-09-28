"""Local auth + account sync endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from web.backend.auth import (
    AuthUser,
    get_current_user,
    hash_password,
    issue_local_token,
    verify_password,
)
from web.backend.config import get_settings
from web.backend.rate_limit import client_key, limiter
from web.backend.services import credits as credits_service
from web.backend.services.unslop import unslop_text

router = APIRouter(prefix="/api/auth", tags=["auth"])


class RegisterRequest(BaseModel):
    email: str = Field(min_length=3, max_length=320)
    password: str = Field(min_length=8, max_length=128)


class LoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    uid: str
    email: str
    credits: int


class MeResponse(BaseModel):
    uid: str
    email: str
    credits: int
    provider: str


@router.post("/register", response_model=TokenResponse)
async def register(body: RegisterRequest, request: Request):
    settings = get_settings()
    if not settings.allow_local_auth:
        raise HTTPException(status_code=403, detail=unslop_text("Local auth disabled"))
    limiter.check(client_key(request, "auth"))
    email = body.email.strip().lower()
    if "@" not in email or "." not in email.split("@")[-1]:
        raise HTTPException(status_code=400, detail=unslop_text("Invalid email"))
    try:
        user = credits_service.create_local_user(email, hash_password(body.password))
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=unslop_text(str(exc))) from exc
    token = issue_local_token(user["uid"], user["email"])
    return TokenResponse(
        access_token=token,
        uid=user["uid"],
        email=user["email"],
        credits=int(user["credits"]),
    )


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, request: Request):
    settings = get_settings()
    if not settings.allow_local_auth:
        raise HTTPException(status_code=403, detail=unslop_text("Local auth disabled"))
    limiter.check(client_key(request, "auth"))
    user = credits_service.get_user_by_email(body.email)
    if not user or not user.get("password_hash"):
        raise HTTPException(status_code=401, detail=unslop_text("Invalid credentials"))
    if not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail=unslop_text("Invalid credentials"))
    token = issue_local_token(user["uid"], user["email"])
    return TokenResponse(
        access_token=token,
        uid=user["uid"],
        email=user["email"],
        credits=int(user["credits"]),
    )


@router.post("/sync", response_model=MeResponse)
async def sync_account(user: AuthUser = Depends(get_current_user)):
    """Ensure Firebase (or local) identity has a backend credit account."""
    row = credits_service.ensure_user(user.uid, user.email, user.provider)
    return MeResponse(
        uid=user.uid,
        email=row["email"] or user.email,
        credits=int(row["credits"]),
        provider=row["provider"],
    )


@router.get("/me", response_model=MeResponse)
async def me(user: AuthUser = Depends(get_current_user)):
    row = credits_service.get_user(user.uid)
    if not row:
        raise HTTPException(status_code=404, detail=unslop_text("User not found"))
    return MeResponse(
        uid=user.uid,
        email=row["email"] or user.email,
        credits=int(row["credits"]),
        provider=row["provider"],
    )
