"""Stripe Checkout (TEST mode) for Cavio multi-tier credit packs.

Mirrors Notra's Free + Starter/Growth/Scale card grid, but uses one-time
Stripe packs (Starter / Pro / Clinic) instead of Autumn subscriptions.
"""

from __future__ import annotations

import logging
from typing import Any, Optional

import stripe
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from web.backend.auth import AuthUser, get_current_user
from web.backend.config import get_settings
from web.backend.plans import FEATURED_PLAN_ID, PAID_PLANS, PLANS, get_plan, paid_plan_ids
from web.backend.services import credits as credits_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["billing"])


class PlanInfo(BaseModel):
    id: str
    name: str
    description: str
    price_cents: int
    credits: int
    featured: bool = False
    stripe_price_id: str = ""


class CreditsResponse(BaseModel):
    credits: int
    scan_cost: int
    pack_credits: int
    pack_price_cents: int
    publishable_key: str
    plans: list[PlanInfo] = Field(default_factory=list)
    featured_plan_id: str = FEATURED_PLAN_ID


class CheckoutRequest(BaseModel):
    plan_id: str = Field(default="pro", description="starter | pro | clinic")


class CheckoutResponse(BaseModel):
    checkout_url: str
    session_id: str
    plan_id: str
    credits: int


def _price_id_for_plan(settings: Any, plan_id: str) -> str:
    mapping = {
        "starter": settings.stripe_price_id_starter,
        "pro": settings.stripe_price_id_pro or settings.stripe_price_id,
        "clinic": settings.stripe_price_id_clinic,
    }
    return (mapping.get(plan_id) or "").strip()


def _plans_payload(settings: Any) -> list[PlanInfo]:
    out: list[PlanInfo] = []
    for plan in PLANS:
        price_id = ""
        if plan.id != "free":
            price_id = _price_id_for_plan(settings, plan.id)
        credits = plan.credits
        if plan.id == "free":
            credits = settings.signup_bonus_credits
        out.append(
            PlanInfo(
                id=plan.id,
                name=plan.name,
                description=plan.description,
                price_cents=plan.price_cents,
                credits=credits,
                featured=plan.featured,
                stripe_price_id=price_id,
            )
        )
    return out


@router.get("/credits", response_model=CreditsResponse)
async def get_credits(user: AuthUser = Depends(get_current_user)):
    settings = get_settings()
    # Back-compat single-pack fields → Pro (featured) tier
    pro = get_plan("pro")
    return CreditsResponse(
        credits=credits_service.get_balance(user.uid),
        scan_cost=settings.scan_credit_cost,
        pack_credits=pro.credits if pro else settings.credits_per_pack,
        pack_price_cents=pro.price_cents if pro else settings.credit_pack_price_cents,
        publishable_key=settings.stripe_publishable_key,
        plans=_plans_payload(settings),
        featured_plan_id=FEATURED_PLAN_ID,
    )


@router.get("/billing/plans", response_model=list[PlanInfo])
async def list_plans():
    """Public plan catalog (no auth) for Settings / paywall cards."""
    return _plans_payload(get_settings())


@router.post("/billing/checkout", response_model=CheckoutResponse)
async def create_checkout(
    body: CheckoutRequest = CheckoutRequest(),
    user: AuthUser = Depends(get_current_user),
):
    settings = get_settings()
    plan_id = (body.plan_id or "pro").strip().lower()
    if plan_id not in paid_plan_ids():
        raise HTTPException(
            status_code=400,
            detail=f"Unknown plan_id. Use one of: {', '.join(sorted(paid_plan_ids()))}",
        )
    plan = get_plan(plan_id)
    assert plan is not None

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
    price_id = _price_id_for_plan(settings, plan_id)
    line_items: list[dict]
    if price_id:
        line_items = [{"price": price_id, "quantity": 1}]
    else:
        line_items = [
            {
                "price_data": {
                    "currency": "usd",
                    "unit_amount": plan.price_cents,
                    "product_data": {
                        "name": f"Cavio {plan.name} ({plan.credits} credits)",
                        "description": plan.description,
                        "metadata": {
                            "cavio_plan_id": plan.id,
                            "credits": str(plan.credits),
                        },
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
                "credits": str(plan.credits),
                "plan_id": plan.id,
            },
            customer_email=user.email or None,
        )
    except stripe.error.StripeError as exc:
        logger.exception("Stripe checkout failed for plan=%s", plan_id)
        raise HTTPException(status_code=502, detail="Stripe checkout failed") from exc

    if not session.url:
        raise HTTPException(status_code=502, detail="Stripe returned no checkout URL")
    return CheckoutResponse(
        checkout_url=session.url,
        session_id=session.id,
        plan_id=plan.id,
        credits=plan.credits,
    )


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
        meta = session.get("metadata") or {}
        uid = meta.get("uid") or session.get("client_reference_id")
        credits_raw = meta.get("credits")
        plan_id = meta.get("plan_id") or ""
        plan = get_plan(plan_id) if plan_id else None
        try:
            amount = int(credits_raw) if credits_raw else (
                plan.credits if plan else settings.credits_per_pack
            )
        except ValueError:
            amount = plan.credits if plan else settings.credits_per_pack
        if uid and amount > 0:
            try:
                credits_service.ensure_user(uid, session.get("customer_email") or "", "stripe")
                credits_service.add_credits(
                    uid,
                    amount,
                    f"stripe_checkout:{plan_id or 'pack'}",
                    ref=session.get("id"),
                )
            except Exception:
                logger.exception("Failed to credit uid=%s plan=%s", uid, plan_id)
                raise HTTPException(status_code=500, detail="Credit update failed")

    return {"ok": True}
