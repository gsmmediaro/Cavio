# Cavio prod ops checklist (manual leftovers)

## Done in this pass
- Firebase Auth authorized domains: `cavio.ro`, `www.cavio.ro`, `cavio.pages.dev` (project `quinn-app-a28ef`)
- Railway `cavio-api` vars: CORS + FRONTEND_* + CHECKOUT_* pointed at `https://cavio.ro` (also keep `https://cavio.pages.dev`)
- Code defaults: backend CORS allows cavio.ro / pages.dev; frontend durable Firebase upload hardened

## Instantly Automaxis Unibox
- Out of scope: Instantly returns `404 Workspace not found` for Automaxis Unibox.
- Action: Instantly support / fix workspace mapping in Instantly dashboard (not code).

## Stripe TEST prices (blocked: no `sk_test_` on machine or Railway)

1. Stripe Dashboard → **Test mode ON**
2. Developers → API keys → copy `sk_test_…` and `pk_test_…`
3. On BMW (or any shell with the key):

```powershell
cd C:\Users\shado\Desktop\Cavio
$env:STRIPE_SECRET_KEY = "sk_test_..."
python scripts/create_stripe_plans.py --write-env
```

Creates recurring Prices (USD):
- Starter $19/mo (25 credits) + yearly $190
- Pro $49/mo (80 credits) + yearly $490
- Clinic $149/mo (250 credits) + yearly $1490

Env vars to set on Railway `cavio-api` (and local `web/backend/.env`):

```
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...   # from Stripe webhook endpoint
STRIPE_PRICE_ID_STARTER=price_...
STRIPE_PRICE_ID_PRO=price_...
STRIPE_PRICE_ID_CLINIC=price_...
STRIPE_PRICE_ID_STARTER_YEARLY=price_...
STRIPE_PRICE_ID_PRO_YEARLY=price_...
STRIPE_PRICE_ID_CLINIC_YEARLY=price_...
STRIPE_PRICE_ID=<same as PRO monthly>
```

4. Stripe webhook endpoint: `https://cavio-api-production.up.railway.app/api/billing/webhook`
   Events: `checkout.session.completed`, `invoice.paid`, `customer.subscription.updated`, `customer.subscription.deleted`
5. Without keys, checkout still works via inline `price_data` (no catalog Price IDs).

## Cloudflare Pages (frontend API URL)

Build env (Pages project `cavio`):

```
VITE_API_BASE_URL=https://cavio-api-production.up.railway.app
VITE_API_URL=https://cavio-api-production.up.railway.app
# plus VITE_FIREBASE_* from web/frontend/.env.local
```

Custom domain: `cavio.ro` / `www.cavio.ro` → Pages. After API CORS deploy, hard-refresh.

## Durable scan images

New scans: browser uploads annotated JPEG to Firebase Storage (`users/{uid}/scans/...`) then stores that URL in Firestore.
Requires: Auth domain OK + Railway CORS allows origin (so fetch of `/static/results/...` succeeds).
Past scans that only have Railway HMAC URLs and whose files were wiped by redeploy cannot be recovered (resign returns 404). Re-run those scans.

## Redeploy after this pass

```powershell
cd C:\Users\shado\Desktop\Cavio
railway up   # or push design + Railway auto-deploy
# Cloudflare Pages: rebuild/deploy frontend so persist hardening ships
```
