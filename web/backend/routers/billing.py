"""Stripe Checkout subscriptions for Cavio plans (TEST mode).

Mirrors Notra monthly/yearly Starter/Growth/Scale UX with Stripe
mode=subscription. Each paid plan grants monthly credits; yearly prices
are 10× monthly (Save 20%). Webhook grants/resets credits on invoice.paid
and subscription lifecycle events.
"""

from __future__ import annotations

import logging
from typing import Any, Optional

import stripe
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from web.backend.auth import AuthUser, get_current_user
from web.backend.config import get_settings
from web.backend.plans import (
    FEATURED_PLAN_ID,
    PLANS,
    VALID_INTERVALS,
    get_plan,
    normalize_interval,
    paid_plan_ids,
)
from web.backend.services import credits as credits_service
from web.backend.services.unslop import unslop_text

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["billing"])


class PlanInfo(BaseModel):
    id: str
    name: str
    description: str
    price_cents: int  # monthly (back-compat)
    price_cents_monthly: int = 0
    price_cents_yearly: int = 0
    credits: int  # monthly allotment (back-compat)
    credits_monthly: int = 0
    featured: bool = False
    stripe_price_id: str = ""  # monthly price id
    stripe_price_id_monthly: str = ""
    stripe_price_id_yearly: str = ""
    interval: str = "month"


class CreditsResponse(BaseModel):
    credits: int
    scan_cost: int
    pack_credits: int  # monthly allotment of featured plan (back-compat key)
    pack_price_cents: int  # monthly price of featured plan
    publishable_key: str
    plans: list[PlanInfo] = Field(default_factory=list)
    featured_plan_id: str = FEATURED_PLAN_ID
    subscription_plan_id: str = ""
    subscription_interval: str = ""
    subscription_status: str = ""


class CheckoutRequest(BaseModel):
    plan_id: str = Field(default="pro", description="starter | pro | clinic")
    interval: str = Field(default="month", description="month | year")


class CheckoutResponse(BaseModel):
    checkout_url: str
    session_id: str
    plan_id: str
    credits: int
    interval: str = "month"


def _price_id_for_plan(settings: Any, plan_id: str, interval: str) -> str:
    monthly = {
        "starter": settings.stripe_price_id_starter,
        "pro": settings.stripe_price_id_pro or settings.stripe_price_id,
        "clinic": settings.stripe_price_id_clinic,
    }
    yearly = {
        "starter": settings.stripe_price_id_starter_yearly,
        "pro": settings.stripe_price_id_pro_yearly,
        "clinic": settings.stripe_price_id_clinic_yearly,
    }
    if interval == "year":
        return (yearly.get(plan_id) or "").strip()
    return (monthly.get(plan_id) or "").strip()


def _plans_payload(settings: Any) -> list[PlanInfo]:
    out: list[PlanInfo] = []
    for plan in PLANS:
        monthly_id = ""
        yearly_id = ""
        if plan.id != "free":
            monthly_id = _price_id_for_plan(settings, plan.id, "month")
            yearly_id = _price_id_for_plan(settings, plan.id, "year")
        credits = plan.credits_monthly
        if plan.id == "free":
            credits = settings.signup_bonus_credits
        out.append(
            PlanInfo(
                id=plan.id,
                name=plan.name,
                description=plan.description,
                price_cents=plan.price_cents_monthly,
                price_cents_monthly=plan.price_cents_monthly,
                price_cents_yearly=plan.price_cents_yearly,
                credits=credits,
                credits_monthly=credits,
                featured=plan.featured,
                stripe_price_id=monthly_id,
                stripe_price_id_monthly=monthly_id,
                stripe_price_id_yearly=yearly_id,
            )
        )
    return out


@router.get("/credits", response_model=CreditsResponse)
async def get_credits(user: AuthUser = Depends(get_current_user)):
    settings = get_settings()
    pro = get_plan("pro")
    sub = credits_service.get_subscription(user.uid) or {}
    return CreditsResponse(
        credits=credits_service.get_balance(user.uid),
        scan_cost=settings.scan_credit_cost,
        pack_credits=pro.credits_monthly if pro else settings.credits_per_pack,
        pack_price_cents=(
            pro.price_cents_monthly if pro else settings.credit_pack_price_cents
        ),
        publishable_key=settings.stripe_publishable_key,
        plans=_plans_payload(settings),
        featured_plan_id=FEATURED_PLAN_ID,
        subscription_plan_id=sub.get("plan_id") or "",
        subscription_interval=sub.get("interval") or "",
        subscription_status=sub.get("status") or "",
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
    interval = normalize_interval(body.interval)
    if plan_id not in paid_plan_ids():
        raise HTTPException(
            status_code=400,
            detail=unslop_text(f"Unknown plan_id. Use one of: {', '.join(sorted(paid_plan_ids()))}"),
        )
    if interval not in VALID_INTERVALS:
        raise HTTPException(status_code=400, detail=unslop_text("interval must be month or year"))
    plan = get_plan(plan_id)
    assert plan is not None

    if not settings.stripe_secret_key:
        raise HTTPException(
            status_code=503,
            detail=unslop_text("Stripe is not configured. Set STRIPE_SECRET_KEY (test mode)."),
        )
    if not settings.stripe_secret_key.startswith("sk_test_"):
        raise HTTPException(
            status_code=503,
            detail=unslop_text("Refusing non-test Stripe key. Use sk_test_... only."),
        )

    stripe.api_key = settings.stripe_secret_key
    price_id = _price_id_for_plan(settings, plan_id, interval)
    amount = plan.price_cents_for(interval)
    credits_grant = plan.credits_for_invoice(interval)
    interval_label = "year" if interval == "year" else "month"

    line_items: list[dict]
    if price_id:
        line_items = [{"price": price_id, "quantity": 1}]
    else:
        # Inline recurring price_data when Stripe Price IDs are unset / keys expired.
        line_items = [
            {
                "price_data": {
                    "currency": "usd",
                    "unit_amount": amount,
                    "recurring": {"interval": interval},
                    "product_data": {
                        "name": f"Cavio {plan.name} ({plan.credits_monthly} credits/{interval_label if interval == 'month' else 'mo'})",
                        "description": (
                            f"{plan.description} "
                            f"{plan.credits_monthly} scan credits per month"
                            + (
                                f" (billed yearly: {plan.credits_monthly * 12} credits granted on payment)."
                                if interval == "year"
                                else "."
                            )
                        ),
                        "metadata": {
                            "cavio_plan_id": plan.id,
                            "credits_monthly": str(plan.credits_monthly),
                            "interval": interval,
                        },
                    },
                },
                "quantity": 1,
            }
        ]

    metadata = {
        "uid": user.uid,
        "plan_id": plan.id,
        "interval": interval,
        "credits": str(credits_grant),
        "credits_monthly": str(plan.credits_monthly),
    }

    try:
        session = stripe.checkout.Session.create(
            mode="subscription",
            line_items=line_items,
            success_url=settings.checkout_success_url,
            cancel_url=settings.checkout_cancel_url,
            client_reference_id=user.uid,
            metadata=metadata,
            subscription_data={"metadata": metadata},
            customer_email=user.email or None,
        )
    except stripe.error.StripeError as exc:
        logger.exception(
            "Stripe subscription checkout failed plan=%s interval=%s", plan_id, interval
        )
        raise HTTPException(status_code=502, detail=unslop_text("Stripe checkout failed")) from exc

    if not session.url:
        raise HTTPException(status_code=502, detail=unslop_text("Stripe returned no checkout URL"))
    return CheckoutResponse(
        checkout_url=session.url,
        session_id=session.id,
        plan_id=plan.id,
        credits=credits_grant,
        interval=interval,
    )


def _grant_from_meta(meta: dict, uid: str, ref: str, email: str = "") -> None:
    plan_id = (meta.get("plan_id") or "").strip()
    interval = normalize_interval(meta.get("interval"))
    plan = get_plan(plan_id) if plan_id else None
    credits_raw = meta.get("credits")
    try:
        amount = int(credits_raw) if credits_raw else 0
    except ValueError:
        amount = 0
    if amount <= 0 and plan:
        amount = plan.credits_for_invoice(interval)
    if not uid or amount <= 0:
        return
    credits_service.ensure_user(uid, email or "", "stripe")
    # Reset allotment to granted amount (subscription period reset).
    credits_service.reset_credits(
        uid,
        amount,
        f"stripe_sub:{plan_id or 'plan'}:{interval}",
        ref=ref,
    )
    credits_service.set_subscription(
        uid,
        plan_id=plan_id or "",
        interval=interval,
        status="active",
        stripe_ref=ref,
    )


def _handle_checkout_completed(session: dict) -> None:
    meta = session.get("metadata") or {}
    uid = meta.get("uid") or session.get("client_reference_id")
    if not uid:
        return

    if session.get("mode") and session.get("mode") != "subscription":
        # Legacy one-time sessions: still credit if metadata present.
        credits_raw = meta.get("credits")
        plan_id = meta.get("plan_id") or ""
        plan = get_plan(plan_id) if plan_id else None
        try:
            amount = int(credits_raw) if credits_raw else (plan.credits if plan else 0)
        except ValueError:
            amount = plan.credits if plan else 0
        if amount > 0:
            credits_service.ensure_user(
                str(uid), session.get("customer_email") or "", "stripe"
            )
            credits_service.add_credits(
                str(uid),
                amount,
                f"stripe_checkout:{plan_id or 'pack'}",
                ref=session.get("id"),
            )
        return

    # Initial subscription grant (invoice.paid subscription_create is skipped below).
    _grant_from_meta(
        meta,
        str(uid),
        ref=session.get("id") or "",
        email=session.get("customer_email") or "",
    )


def _handle_invoice_paid(invoice: dict) -> None:
    billing_reason = invoice.get("billing_reason") or ""
    # Skip first invoice — checkout.session.completed already granted.
    if billing_reason == "subscription_create":
        return
    # subscription_cycle / update: grant/reset monthly (or yearly) allotment
    if billing_reason not in {"subscription_cycle", "subscription_update", ""}:
        return

    meta: dict = {}
    # Prefer subscription metadata
    sub_id = invoice.get("subscription")
    settings = get_settings()
    stripe.api_key = settings.stripe_secret_key
    if sub_id:
        try:
            sub = stripe.Subscription.retrieve(sub_id)
            meta = dict(sub.get("metadata") or {})
        except stripe.error.StripeError:
            logger.exception("Failed to retrieve subscription %s", sub_id)

    if not meta.get("uid"):
        # Fall back to invoice lines / parent
        lines = (invoice.get("lines") or {}).get("data") or []
        for line in lines:
            price = line.get("price") or {}
            pmeta = price.get("metadata") or {}
            if pmeta.get("cavio_plan_id"):
                meta.setdefault("plan_id", pmeta.get("cavio_plan_id"))
                meta.setdefault("credits_monthly", pmeta.get("credits_monthly"))
                meta.setdefault("interval", pmeta.get("interval"))

    uid = meta.get("uid") or ""
    if not uid:
        # Try client_reference via customer — last resort skip
        logger.warning("invoice.paid without uid metadata invoice=%s", invoice.get("id"))
        return

    # Deduplicate vs checkout.session.completed for subscription_create:
    # use invoice id as ref; reset_credits is idempotent per event via mark_stripe_event.
    interval = normalize_interval(meta.get("interval"))
    plan_id = meta.get("plan_id") or ""
    plan = get_plan(plan_id) if plan_id else None
    if plan and not meta.get("credits"):
        meta = {**meta, "credits": str(plan.credits_for_invoice(interval))}

    # For subscription_create, checkout.session.completed may have already granted.
    # Skip re-grant if ledger already has this subscription's checkout ref —
    # but invoice id is unique so we always reset on cycle; on create, reset is fine
    # (same amount).
    _grant_from_meta(
        meta,
        str(uid),
        ref=invoice.get("id") or "",
        email=invoice.get("customer_email") or "",
    )


def _handle_subscription_event(sub: dict, status_override: Optional[str] = None) -> None:
    meta = sub.get("metadata") or {}
    uid = meta.get("uid")
    if not uid:
        return
    status = status_override or sub.get("status") or ""
    plan_id = meta.get("plan_id") or ""
    interval = normalize_interval(meta.get("interval"))
    credits_service.ensure_user(str(uid), "", "stripe")
    credits_service.set_subscription(
        str(uid),
        plan_id=plan_id if status in {"active", "trialing"} else "",
        interval=interval if status in {"active", "trialing"} else "",
        status=status,
        stripe_ref=sub.get("id"),
    )


@router.post("/billing/webhook")
async def stripe_webhook(request: Request):
    settings = get_settings()
    if not settings.stripe_secret_key or not settings.stripe_webhook_secret:
        raise HTTPException(status_code=503, detail=unslop_text("Stripe webhook not configured"))

    payload = await request.body()
    sig = request.headers.get("stripe-signature", "")
    stripe.api_key = settings.stripe_secret_key
    try:
        event = stripe.Webhook.construct_event(
            payload, sig, settings.stripe_webhook_secret
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=unslop_text("Invalid payload")) from exc
    except stripe.error.SignatureVerificationError as exc:
        raise HTTPException(status_code=400, detail=unslop_text("Invalid signature")) from exc

    event_id = event["id"]
    if not credits_service.mark_stripe_event_processed(event_id):
        return {"ok": True, "duplicate": True}

    etype = event["type"]
    obj = event["data"]["object"]

    try:
        if etype == "checkout.session.completed":
            _handle_checkout_completed(obj)
        elif etype == "invoice.paid":
            _handle_invoice_paid(obj)
        elif etype == "customer.subscription.updated":
            _handle_subscription_event(obj)
        elif etype == "customer.subscription.deleted":
            _handle_subscription_event(obj, status_override="canceled")
    except Exception:
        logger.exception("Webhook handler failed type=%s", etype)
        raise HTTPException(status_code=500, detail=unslop_text("Webhook handler failed"))

    return {"ok": True}
