#!/usr/bin/env python3
"""Create/update Cavio Stripe TEST Products + Prices for multi-tier packs.

Requires STRIPE_SECRET_KEY=sk_test_... (never live).
Idempotent: looks up products by metadata.cavio_plan_id.

Usage:
  set STRIPE_SECRET_KEY=sk_test_...
  python scripts/create_stripe_plans.py

Prints env lines to paste into web/backend/.env
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

# Load backend .env if present
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
    sys.exit(1)
if not key.startswith("sk_test_"):
    print("Refusing non-test key. Use sk_test_... only.", file=sys.stderr)
    sys.exit(1)

stripe.api_key = key

ENV_MAP = {
    "starter": "STRIPE_PRICE_ID_STARTER",
    "pro": "STRIPE_PRICE_ID_PRO",
    "clinic": "STRIPE_PRICE_ID_CLINIC",
}


def find_product(plan_id: str):
    products = stripe.Product.search(
        query=f"metadata['cavio_plan_id']:'{plan_id}' AND active:'true'",
        limit=1,
    )
    if products.data:
        return products.data[0]
    # Fallback list scan (search may be unavailable on some accounts)
    for prod in stripe.Product.list(limit=100, active=True).auto_paging_iter():
        if (prod.metadata or {}).get("cavio_plan_id") == plan_id:
            return prod
    return None


def ensure_price(product_id: str, amount_cents: int, credits: int, plan_id: str):
    for price in stripe.Price.list(product=product_id, active=True, limit=20).auto_paging_iter():
        if (
            price.unit_amount == amount_cents
            and price.currency == "usd"
            and price.type == "one_time"
            and (price.metadata or {}).get("cavio_plan_id") == plan_id
        ):
            return price
    return stripe.Price.create(
        product=product_id,
        unit_amount=amount_cents,
        currency="usd",
        metadata={
            "cavio_plan_id": plan_id,
            "credits": str(credits),
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
                    "credits": str(plan.credits),
                },
            )
            print(f"updated product {prod.id} ({plan.id})")
        else:
            prod = stripe.Product.create(
                name=name,
                description=plan.description,
                metadata={
                    "cavio_plan_id": plan.id,
                    "credits": str(plan.credits),
                },
            )
            print(f"created product {prod.id} ({plan.id})")

        price = ensure_price(prod.id, plan.price_cents, plan.credits, plan.id)
        env_key = ENV_MAP[plan.id]
        results[env_key] = price.id
        print(f"  price {price.id}  ${plan.price_cents/100:.2f} / {plan.credits} credits")

    print("\n# Paste into web/backend/.env (TEST mode):")
    for k, v in results.items():
        print(f"{k}={v}")
    # Back-compat: default single pack → Pro
    print(f"STRIPE_PRICE_ID={results.get('STRIPE_PRICE_ID_PRO', '')}")

    # Optionally patch .env
    if env_path.is_file() and "--write-env" in sys.argv:
        text = env_path.read_text(encoding="utf-8")
        for k, v in results.items():
            line = f"{k}={v}"
            if f"{k}=" in text:
                import re

                text = re.sub(rf"^{k}=.*$", line, text, flags=re.M)
            else:
                text = text.rstrip() + "\n" + line + "\n"
        if "STRIPE_PRICE_ID=" in text:
            import re

            text = re.sub(
                r"^STRIPE_PRICE_ID=.*$",
                f"STRIPE_PRICE_ID={results.get('STRIPE_PRICE_ID_PRO', '')}",
                text,
                flags=re.M,
            )
        else:
            text = text.rstrip() + f"\nSTRIPE_PRICE_ID={results.get('STRIPE_PRICE_ID_PRO', '')}\n"
        env_path.write_text(text, encoding="utf-8")
        print(f"\nWrote price IDs into {env_path}")


if __name__ == "__main__":
    main()
