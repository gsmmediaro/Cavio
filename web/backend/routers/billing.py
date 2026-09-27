"""Stripe Checkout (TEST mode) for a single credit pack product."""

from __future__ import annotations

import logging
from typing import Optional

import stripe
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from web.backend.auth import AuthUser, get_current_user
from web.backend.config import get_settings
from web.backend.services import credits as credits_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["billing"])


class CreditsResponse(BaseModel):
    credits: int
    scan_cost: int
    pack_credits: int
    pack_price_cents: int
    publishable_key: str


class CheckoutResponse(BaseModel):
    checkout_url: str
    session_id: str


@router.get("/credits", response_model=CreditsResponse)
async def get_credits(user: AuthUser = Depends(get_current_user)):
    settings = get_settings()
    return CreditsResponse(
        credits=credits_service.get_balance(user.uid),
        scan_cost=settings.scan_credit_cost,
        pack_credits=settings.credits_per_pack,
        pack_price_cents=settings.credit_pack_price_cents,
        publishable_key=settings.stripe_publishable_key,
    )


@router.post("/billing/checkout", response_model=CheckoutResponse)
async def create_checkout(user: AuthUser = Depends(get_current_user)):
    settings = get_settings()
    if not settings.stripe_secret_key:
        raise HTTPException(
            status_code=503,
            detail="Stripe is not configured. Set STRIPE_SECRET_KEY (test mode).",
        )
    if not settings.stripe_secret_key.startswith("sk_test_"):
        raise HTTPException(
            status_code=503,
            detail="Refusing non-test Stripe key. Use sk_test_... only.",
        )

    stripe.api_key = settings.stripe_secret_key
    line_items: list[dict]
    if settings.stripe_price_id:
        line_items = [{"price": settings.stripe_price_id, "quantity": 1}]
    else:
        line_items = [
            {
                "price_data": {
                    "currency": "usd",
                    "unit_amount": settings.credit_pack_price_cents,
                    "product_data": {
                        "name": f"Cavio scan credits ({settings.credits_per_pack})",
                        "description": "One credit pack for panoramic caries screening",
                    },
                },
                "quantity": 1,
            }
        ]

    try:
        session = stripe.checkout.Session.create(
            mode="payment",
            line_items=line_items,
            success_url=settings.checkout_success_url,
            cancel_url=settings.checkout_cancel_url,
            client_reference_id=user.uid,
            metadata={
                "uid": user.uid,
                "credits": str(settings.credits_per_pack),
            },
            customer_email=user.email or None,
        )
    except stripe.error.StripeError as exc:
        logger.exception("Stripe checkout failed")
        raise HTTPException(status_code=502, detail="Stripe checkout failed") from exc

    if not session.url:
        raise HTTPException(status_code=502, detail="Stripe returned no checkout URL")
    return CheckoutResponse(checkout_url=session.url, session_id=session.id)


@router.post("/billing/webhook")
async def stripe_webhook(request: Request):
    settings = get_settings()
    if not settings.stripe_secret_key or not settings.stripe_webhook_secret:
        raise HTTPException(status_code=503, detail="Stripe webhook not configured")

    payload = await request.body()
    sig = request.headers.get("stripe-signature", "")
    stripe.api_key = settings.stripe_secret_key
    try:
        event = stripe.Webhook.construct_event(
            payload, sig, settings.stripe_webhook_secret
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid payload") from exc
    except stripe.error.SignatureVerificationError as exc:
        raise HTTPException(status_code=400, detail="Invalid signature") from exc

    event_id = event["id"]
    if not credits_service.mark_stripe_event_processed(event_id):
        return {"ok": True, "duplicate": True}

    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]
        uid = (
            (session.get("metadata") or {}).get("uid")
            or session.get("client_reference_id")
        )
        credits_raw = (session.get("metadata") or {}).get("credits")
        try:
            amount = int(credits_raw) if credits_raw else settings.credits_per_pack
        except ValueError:
            amount = settings.credits_per_pack
        if uid and amount > 0:
            try:
                credits_service.ensure_user(uid, session.get("customer_email") or "", "stripe")
                credits_service.add_credits(
                    uid, amount, "stripe_checkout", ref=session.get("id")
                )
            except Exception:
                logger.exception("Failed to credit uid=%s", uid)
                raise HTTPException(status_code=500, detail="Credit update failed")

    return {"ok": True}
