# Cavio security hardening & credits (defensive)

## What was mapped

| Area | Before | After |
|------|--------|-------|
| Auth | Firebase on frontend only; /api/analyze open | Bearer JWT required when AUTH_REQUIRED=true (Firebase ID token or local HS256) |
| Upload | No server size/type checks | Magic-byte + size cap (MAX_UPLOAD_BYTES, default 20MB) → 413/400 |
| Rate limit | None | In-memory sliding window → 429 |
| Credits / Stripe | Missing | SQLite balance, deduct on scan, Stripe Checkout TEST **subscriptions** |
| CORS | * methods/headers | Explicit methods/headers |
| model_path | Any filesystem path | Allowlisted to discovered weights only |
| Secrets | N/A | Env placeholders only; never commit keys |

## Accounts

- **Firebase** (existing UI): email/password + Google. After sign-in, frontend calls POST /api/auth/sync so the backend creates a credit row keyed by Firebase UID.
- **Local stub** (API / tests): POST /api/auth/register and /api/auth/login issue HS256 JWTs (CAVIO_AUTH_SECRET).

New users receive SIGNUP_BONUS_CREDITS (default 3). Each successful analyze deducts SCAN_CREDIT_COST (default 1). Zero balance → HTTP 402.

## Stripe TEST setup (subscriptions)

1. Create a [Stripe test mode](https://dashboard.stripe.com/test/apikeys) account.
2. Copy **Secret** (sk_test_...) and **Publishable** (pk_test_...) into web/backend/.env (see .env.example).
3. Create recurring Prices:
   ```powershell
   cd C:\Users\shado\Desktop\Cavio
   .\.venv311\Scripts\python.exe scripts\create_stripe_plans.py --write-env
   ```
   Sets `STRIPE_PRICE_ID_{STARTER,PRO,CLINIC}` (month) and `*_YEARLY` (year = 10× month / Save 20%).
4. **If Stripe keys are missing/expired:** checkout still works via inline `price_data` + `recurring.interval` — UI is not blocked. Document keys and re-run the script when keys are valid.
5. Forward webhooks locally:
   ```bash
   stripe listen --forward-to localhost:8000/api/billing/webhook
   ```
   Put the printed `whsec_...` into `STRIPE_WEBHOOK_SECRET`.
6. Restart the API. Settings → Plans → Subscribe (Monthly/Yearly). Test card `4242 4242 4242 4242`.

Server refuses non-`sk_test_` secret keys.

### Webhook credit behavior

| Event | Behavior |
|-------|----------|
| `checkout.session.completed` (mode=subscription) | Grant/reset credits for the selected interval; store plan/interval/status on user |
| `invoice.paid` (`subscription_cycle` / `subscription_update`) | Grant/reset period credits (month = monthly allotment; year = 12× monthly) |
| `invoice.paid` (`subscription_create`) | Skipped (initial grant already done on checkout) |
| `customer.subscription.updated` | Sync subscription status/plan on user |
| `customer.subscription.deleted` | Mark canceled; clear active plan id |

## Multi-tier pricing (Notra-adapted subscriptions)

Notra SoT: **Free + Starter / Growth / Scale** via Autumn, Monthly/Yearly toggle (yearly ≈ 10× month).

Cavio mirrors with **Stripe Checkout `mode=subscription`**:

| Plan | Monthly | Yearly (Save 20%) | Credits / mo | Stripe env (month / year) |
|------|---------|-------------------|--------------|---------------------------|
| Free | $0 | — | SIGNUP_BONUS (3) | — |
| Starter | $19 | $190 | 25 | `STRIPE_PRICE_ID_STARTER` / `_YEARLY` |
| Pro (featured) | $49 | $490 | 80 | `STRIPE_PRICE_ID_PRO` / `_YEARLY` |
| Clinic | $149 | $1,490 | 250 | `STRIPE_PRICE_ID_CLINIC` / `_YEARLY` |

Checkout: `POST /api/billing/checkout` body `{ "plan_id": "starter"|"pro"|"clinic", "interval": "month"|"year" }`.

UI: Settings → Plans shows Free + 3 cards with Monthly/Yearly toggle and **Subscribe**; paywall dialog has the same toggle; Credits → Subscribe is an optional shortcut into monthly checkout (primary path remains Plans).

## Run API + frontend

```powershell
cd C:\Users\shado\Desktop\Cavio
.\.venv311\Scripts\python.exe -m uvicorn web.backend.main:app --host 127.0.0.1 --port 8000
cd web\frontend
npm run dev -- --host 127.0.0.1 --port 5173
```

Set FIREBASE_PROJECT_ID to the same project as VITE_FIREBASE_PROJECT_ID so Firebase ID tokens verify.

## Defensive tests

```powershell
cd C:\Users\shado\Desktop\Cavio
.\.venv311\Scripts\python.exe -m pytest web/backend/tests -q
```

Asserts: unauthenticated analyze → 401, oversized upload → 413, rate limit → 429, zero credits → 402. No exploit scripts.

## Remaining risks

- Annotated results under /static/results/ remain publicly fetchable if the UUID URL is known (short UUID). Prefer signed URLs or auth-gated media later.
- In-memory rate limits do not share across multiple API workers; use Redis for production multi-instance.
- Firebase rules allow full read/write on the user subtree; tighten field-level rules for production.
- Local CAVIO_AUTH_SECRET default is insecure — always set in production.
- Guest free-scan via localStorage is UI-only; with AUTH_REQUIRED=true the API rejects anonymous scans (intended).
- DigiRay integration is out of scope for this pass.
- Stripe keys currently empty in local `.env` → checkout uses inline recurring `price_data` until `create_stripe_plans.py` is run with valid `sk_test_`.
