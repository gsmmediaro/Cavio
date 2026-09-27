# Cavio security hardening & credits (defensive)

## What was mapped

| Area | Before | After |
|------|--------|-------|
| Auth | Firebase on frontend only; /api/analyze open | Bearer JWT required when AUTH_REQUIRED=true (Firebase ID token or local HS256) |
| Upload | No server size/type checks | Magic-byte + size cap (MAX_UPLOAD_BYTES, default 20MB) → 413/400 |
| Rate limit | None | In-memory sliding window → 429 |
| Credits / Stripe | Missing | SQLite balance, deduct on scan, Stripe Checkout TEST pack |
| CORS | * methods/headers | Explicit methods/headers |
| model_path | Any filesystem path | Allowlisted to discovered weights only |
| Secrets | N/A | Env placeholders only; never commit keys |

## Accounts

- **Firebase** (existing UI): email/password + Google. After sign-in, frontend calls POST /api/auth/sync so the backend creates a credit row keyed by Firebase UID.
- **Local stub** (API / tests): POST /api/auth/register and /api/auth/login issue HS256 JWTs (CAVIO_AUTH_SECRET).

New users receive SIGNUP_BONUS_CREDITS (default 3). Each successful analyze deducts SCAN_CREDIT_COST (default 1). Zero balance → HTTP 402.

## Stripe TEST setup

1. Create a [Stripe test mode](https://dashboard.stripe.com/test/apikeys) account.
2. Copy **Secret** (sk_test_...) and **Publishable** (pk_test_...) into web/backend/.env (see .env.example).
3. Optional: create a Product/Price in Dashboard and set STRIPE_PRICE_ID=price_.... If unset, Checkout uses price_data for one pack (CREDITS_PER_PACK / CREDIT_PACK_PRICE_CENTS).
4. Forward webhooks locally:
   `ash
   stripe listen --forward-to localhost:8000/api/billing/webhook
   `
   Put the printed whsec_... into STRIPE_WEBHOOK_SECRET.
5. Restart the API. In the UI: Settings → Buy credits → complete test card 4242 4242 4242 4242.
6. Confirm balance via GET /api/credits (Bearer token).

Server refuses non-sk_test_ secret keys.



## Multi-tier pricing (Notra-adapted)

Notra (usenotra SoT) exposes **Free + Starter / Growth / Scale** subscription cards via Autumn,
plus separate AI credit top-up presets (///).

Cavio keeps **Stripe Checkout TEST** (one-time packs, no Autumn) but mirrors the card grid:

| Plan | Price | Credits | Stripe env |
|------|-------|---------|------------|
| Free |  | SIGNUP_BONUS_CREDITS (default 3) | — |
| Starter |  | 25 | STRIPE_PRICE_ID_STARTER |
| Pro (featured) |  | 80 | STRIPE_PRICE_ID_PRO (also STRIPE_PRICE_ID back-compat) |
| Clinic |  | 250 | STRIPE_PRICE_ID_CLINIC |

### Create Products + Prices (TEST mode only)

`powershell
cd C:\Users\shado\Desktop\Cavio
# Ensure web/backend/.env has STRIPE_SECRET_KEY=sk_test_... (never sk_live_)
.\\.venv311\Scripts\python.exe scripts\create_stripe_plans.py --write-env
`

The script is idempotent (matches metadata.cavio_plan_id). Checkout accepts
POST /api/billing/checkout with body { "plan_id": "starter"|"pro"|"clinic" }.
If a price id env is empty, Checkout falls back to inline price_data for that tier.

UI: Settings → Plans shows Free + 3 pack cards; paywall dialog shows the 3 paid cards;
Credits → Top up offers the same three presets.

## Run API + frontend

`powershell
cd C:\Users\shado\Desktop\Cavio
# load env as you prefer, e.g. copy web\backend\.env.example → .env and set vars
.\\.venv311\Scripts\python.exe -m uvicorn web.backend.main:app --host 127.0.0.1 --port 8000
cd web\frontend
npm run dev -- --host 127.0.0.1 --port 5173
`

Set FIREBASE_PROJECT_ID to the same project as VITE_FIREBASE_PROJECT_ID so Firebase ID tokens verify.

## Defensive tests

`powershell
cd C:\Users\shado\Desktop\Cavio
.\\.venv311\Scripts\python.exe -m pytest web/backend/tests -q
`

Asserts: unauthenticated analyze → 401, oversized upload → 413, rate limit → 429, zero credits → 402. No exploit scripts.

## Remaining risks

- Annotated results under /static/results/ remain publicly fetchable if the UUID URL is known (short UUID). Prefer signed URLs or auth-gated media later.
- In-memory rate limits do not share across multiple API workers; use Redis for production multi-instance.
- Firebase rules allow full read/write on the user subtree; tighten field-level rules for production.
- Local CAVIO_AUTH_SECRET default is insecure — always set in production.
- Guest free-scan via localStorage is UI-only; with AUTH_REQUIRED=true the API rejects anonymous scans (intended).
- DigiRay integration is out of scope for this pass.
