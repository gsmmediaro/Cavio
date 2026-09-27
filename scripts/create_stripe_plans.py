#!/usr/bin/env python3
"""Create/update Cavio Stripe TEST Products + recurring Prices (month + year).

Requires STRIPE_SECRET_KEY=sk_test_... (never live).
Idempotent: looks up products by metadata.cavio_plan_id.
Yearly = 10 × monthly (Save 20%).

Usage:
  set STRIPE_SECRET_KEY=sk_test_...
  python scripts/create_stripe_plans.py
  python scripts/create_stripe_plans.py --write-env

Prints env lines to paste into web/backend/.env

If Stripe keys are missing/expired, checkout falls back to inline
price_data with recurring.interval — UI is not blocked.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

env_path = ROOT / "web" / "backend" / ".env"
if env_path.is_file():
    for raw in env_path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        k, v = k.strip(), v.strip().strip('"').strip("'")
        if k and k not in os.environ:
            os.environ[k] = v

try:
    import stripe
except ImportError:
    print("Install stripe: pip install stripe", file=sys.stderr)
    sys.exit(1)

from web.backend.plans import PAID_PLANS

key = (os.getenv("STRIPE_SECRET_KEY") or "").strip()
if not key:
    print("STRIPE_SECRET_KEY is required", file=sys.stderr)
    print(
        "NOTE: Without keys, checkout uses inline recurring price_data — UI works.",
        file=sys.stderr,
    )
    sys.exit(1)
if not key.startswith("sk_test_"):
    print("Refusing non-test key. Use sk_test_... only.", file=sys.stderr)
    sys.exit(1)

stripe.api_key = key

ENV_MAP = {
    ("starter", "month"): "STRIPE_PRICE_ID_STARTER",
    ("pro", "month"): "STRIPE_PRICE_ID_PRO",
    ("clinic", "month"): "STRIPE_PRICE_ID_CLINIC",
    ("starter", "year"): "STRIPE_PRICE_ID_STARTER_YEARLY",
    ("pro", "year"): "STRIPE_PRICE_ID_PRO_YEARLY",
    ("clinic", "year"): "STRIPE_PRICE_ID_CLINIC_YEARLY",
}


def find_product(plan_id: str):
    try:
        products = stripe.Product.search(
            query=f"metadata['cavio_plan_id']:'{plan_id}' AND active:'true'",
            limit=1,
        )
        if products.data:
            return products.data[0]
    except Exception:
        pass
    for prod in stripe.Product.list(limit=100, active=True).auto_paging_iter():
        if (prod.metadata or {}).get("cavio_plan_id") == plan_id:
            return prod
    return None


def ensure_recurring_price(
    product_id: str,
    amount_cents: int,
    credits_monthly: int,
    plan_id: str,
    interval: str,
):
    for price in stripe.Price.list(product=product_id, active=True, limit=40).auto_paging_iter():
        recurring = price.recurring or {}
        if (
            price.unit_amount == amount_cents
            and price.currency == "usd"
            and price.type == "recurring"
            and recurring.get("interval") == interval
            and (price.metadata or {}).get("cavio_plan_id") == plan_id
        ):
            return price
    return stripe.Price.create(
        product=product_id,
        unit_amount=amount_cents,
        currency="usd",
        recurring={"interval": interval},
        metadata={
            "cavio_plan_id": plan_id,
            "credits_monthly": str(credits_monthly),
            "interval": interval,
        },
    )


def main() -> None:
    results = {}
    for plan in PAID_PLANS:
        name = f"Cavio {plan.name}"
        prod = find_product(plan.id)
        if prod:
            stripe.Product.modify(
                prod.id,
                name=name,
                description=plan.description,
                metadata={
                    "cavio_plan_id": plan.id,
                    "credits_monthly": str(plan.credits_monthly),
                },
            )
            print(f"updated product {prod.id} ({plan.id})")
        else:
            prod = stripe.Product.create(
                name=name,
                description=plan.description,
                metadata={
                    "cavio_plan_id": plan.id,
                    "credits_monthly": str(plan.credits_monthly),
                },
            )
            print(f"created product {prod.id} ({plan.id})")

        for interval, amount in (
            ("month", plan.price_cents_monthly),
            ("year", plan.price_cents_yearly),
        ):
            price = ensure_recurring_price(
                prod.id, amount, plan.credits_monthly, plan.id, interval
            )
            env_key = ENV_MAP[(plan.id, interval)]
            results[env_key] = price.id
            label = f"${amount/100:.2f}/{interval}"
            print(
                f"  price {price.id}  {label}  "
                f"({plan.credits_monthly} credits/mo)"
            )

    print("\n# Paste into web/backend/.env (TEST mode, recurring):")
    for k in (
        "STRIPE_PRICE_ID_STARTER",
        "STRIPE_PRICE_ID_PRO",
        "STRIPE_PRICE_ID_CLINIC",
        "STRIPE_PRICE_ID_STARTER_YEARLY",
        "STRIPE_PRICE_ID_PRO_YEARLY",
        "STRIPE_PRICE_ID_CLINIC_YEARLY",
    ):
        print(f"{k}={results.get(k, '')}")
    print(f"STRIPE_PRICE_ID={results.get('STRIPE_PRICE_ID_PRO', '')}")

    if env_path.is_file() and "--write-env" in sys.argv:
        import re

        text = env_path.read_text(encoding="utf-8")
        for k, v in results.items():
            line = f"{k}={v}"
            if f"{k}=" in text:
                text = re.sub(rf"^{k}=.*$", line, text, flags=re.M)
            else:
                text = text.rstrip() + "\n" + line + "\n"
        if "STRIPE_PRICE_ID=" in text:
            text = re.sub(
                r"^STRIPE_PRICE_ID=.*$",
                f"STRIPE_PRICE_ID={results.get('STRIPE_PRICE_ID_PRO', '')}",
                text,
                flags=re.M,
            )
        else:
            text = (
                text.rstrip()
                + f"\nSTRIPE_PRICE_ID={results.get('STRIPE_PRICE_ID_PRO', '')}\n"
            )
        env_path.write_text(text, encoding="utf-8")
        print(f"\nWrote price IDs into {env_path}")


if __name__ == "__main__":
    main()
