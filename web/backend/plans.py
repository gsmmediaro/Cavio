"""Cavio recurring subscription plans — Notra-style Free + Starter/Pro/Clinic.

Notra SoT: monthly/yearly Starter/Growth/Scale via Autumn.
Cavio mirrors that UX with Stripe Checkout mode=subscription.
Each paid plan grants monthly scan credits; yearly is ~10× monthly (Save 20%).
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

# Yearly = 10 × monthly (2 months free / Save 20%).
YEARLY_MONTHS_BILLED = 10


@dataclass(frozen=True)
class PlanDef:
    id: str
    name: str
    description: str
    price_cents_monthly: int
    credits_monthly: int
    featured: bool = False
    stripe_price_env_monthly: str = ""
    stripe_price_env_yearly: str = ""

    @property
    def price_cents(self) -> int:
        """Back-compat alias = monthly."""
        return self.price_cents_monthly

    @property
    def credits(self) -> int:
        """Back-compat alias = monthly allotment."""
        return self.credits_monthly

    @property
    def price_cents_yearly(self) -> int:
        return self.price_cents_monthly * YEARLY_MONTHS_BILLED

    def price_cents_for(self, interval: str) -> int:
        if interval == "year":
            return self.price_cents_yearly
        return self.price_cents_monthly

    def credits_for_invoice(self, interval: str) -> int:
        """Credits granted when a subscription invoice is paid."""
        if interval == "year":
            return self.credits_monthly * 12
        return self.credits_monthly


PLANS: tuple[PlanDef, ...] = (
    PlanDef(
        id="free",
        name="Free",
        description="Try Cavio on a few OPGs. Subscribe when you need more.",
        price_cents_monthly=0,
        credits_monthly=3,
    ),
    PlanDef(
        id="starter",
        name="Starter",
        description="For solo dentists screening a handful of OPGs each week.",
        price_cents_monthly=1900,
        credits_monthly=25,
        stripe_price_env_monthly="STRIPE_PRICE_ID_STARTER",
        stripe_price_env_yearly="STRIPE_PRICE_ID_STARTER_YEARLY",
    ),
    PlanDef(
        id="pro",
        name="Pro",
        description="For busy chairs running regular panoramic caries screening.",
        price_cents_monthly=4900,
        credits_monthly=80,
        featured=True,
        stripe_price_env_monthly="STRIPE_PRICE_ID_PRO",
        stripe_price_env_yearly="STRIPE_PRICE_ID_PRO_YEARLY",
    ),
    PlanDef(
        id="clinic",
        name="Clinic",
        description="For multi-chair clinics and high OPG volume.",
        price_cents_monthly=14900,
        credits_monthly=250,
        stripe_price_env_monthly="STRIPE_PRICE_ID_CLINIC",
        stripe_price_env_yearly="STRIPE_PRICE_ID_CLINIC_YEARLY",
    ),
)

PAID_PLANS: tuple[PlanDef, ...] = tuple(p for p in PLANS if p.id != "free")
FEATURED_PLAN_ID = "pro"
VALID_INTERVALS = frozenset({"month", "year"})


def get_plan(plan_id: str) -> Optional[PlanDef]:
    for plan in PLANS:
        if plan.id == plan_id:
            return plan
    return None


def paid_plan_ids() -> set[str]:
    return {p.id for p in PAID_PLANS}


def normalize_interval(raw: str | None) -> str:
    value = (raw or "month").strip().lower()
    if value in {"yearly", "annual", "annually", "year"}:
        return "year"
    return "month"
