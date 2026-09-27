"""Cavio multi-tier credit packs — adapted from Notra Starter/Growth/Scale grid.

Notra uses Autumn subscriptions (Free + Starter/Growth/Scale). Cavio keeps
Stripe Checkout one-time packs but exposes the same multi-card plan pattern.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional


@dataclass(frozen=True)
class PlanDef:
    id: str
    name: str
    description: str
    price_cents: int
    credits: int
    featured: bool = False
    stripe_price_env: str = ""


# Free allowance is SIGNUP_BONUS_CREDITS (config); listed for UI parity.
PLANS: tuple[PlanDef, ...] = (
    PlanDef(
        id="free",
        name="Free",
        description="Try Cavio on a few OPGs. Buy a pack when you need more.",
        price_cents=0,
        credits=3,
    ),
    PlanDef(
        id="starter",
        name="Starter",
        description="For solo dentists screening a handful of OPGs each week.",
        price_cents=1900,
        credits=25,
        stripe_price_env="STRIPE_PRICE_ID_STARTER",
    ),
    PlanDef(
        id="pro",
        name="Pro",
        description="For busy chairs running regular panoramic caries screening.",
        price_cents=4900,
        credits=80,
        featured=True,
        stripe_price_env="STRIPE_PRICE_ID_PRO",
    ),
    PlanDef(
        id="clinic",
        name="Clinic",
        description="For multi-chair clinics and high OPG volume.",
        price_cents=14900,
        credits=250,
        stripe_price_env="STRIPE_PRICE_ID_CLINIC",
    ),
)

PAID_PLANS: tuple[PlanDef, ...] = tuple(p for p in PLANS if p.id != "free")
FEATURED_PLAN_ID = "pro"


def get_plan(plan_id: str) -> Optional[PlanDef]:
    for plan in PLANS:
        if plan.id == plan_id:
            return plan
    return None


def paid_plan_ids() -> set[str]:
    return {p.id for p in PAID_PLANS}
