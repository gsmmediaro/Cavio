# Cavio Cloudflare redeploy plan (draft — do not commit secrets)

## Architecture (honest)
- Frontend: Cloudflare Pages (Vite SPA static assets). Optional thin Worker only for edge routing/auth headers — NOT for YOLO.
- API: Keep FastAPI + ultralytics on Railway/Fly/Docker/GPU container. CF Workers cannot run YOLO/ultralytics.
- Auth: Firebase client + AUTH_REQUIRED Bearer on API.
- Billing: Stripe Checkout + webhook on API origin.

## Prior evidence found
- Railway: nixpacks.toml, Dockerfile, serve.py "Railway", commits da9e408 / 880e736. No live Railway project named Cavio in current account list.
- Frontend: vercel.json SPA rewrites; CORS default regex allows *.vercel.app.
- Firebase: project id quinn-***8ef (Quinn branding leftover); .firebaserc empty; firebase.json has Firestore/Storage only (no Hosting targets).
- No wrangler.toml in Cavio; Cloudflare account contact@dictando.ro has pages:write.
- Domain: none found (no cavio.ro / Hostgate emails / DNS notes). Hostgate mentioned by Stefan only — DNS would be CNAME at Hostgate cPanel → <project>.pages.dev after Pages Custom Domain is added in CF dashboard first.

## Env vars
### Frontend build (Pages / CI)
- VITE_FIREBASE_* (from .env.example)
- VITE_API_BASE_URL=https://<API-HOST>   # NOT localhost
- VITE_API_URL=https://<API-HOST>
- VITE_ENABLE_SOURCE_UPLOAD=true|false

### API (Railway/container) — set in platform secrets, never commit
- AUTH_REQUIRED=true
- CAVIO_AUTH_SECRET=<long random>
- ALLOW_LOCAL_AUTH=false   # production
- FIREBASE_PROJECT_ID=<same as VITE_FIREBASE_PROJECT_ID>
- MAX_UPLOAD_BYTES, RATE_LIMIT_*
- SIGNUP_BONUS_CREDITS, SCAN_CREDIT_COST, CREDITS_PER_PACK, CREDIT_PACK_PRICE_CENTS
- STRIPE_SECRET_KEY, STRIPE_PUBLISHABLE_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_ID
- CHECKOUT_SUCCESS_URL=https://<FRONTEND>/settings?credits=success
- CHECKOUT_CANCEL_URL=https://<FRONTEND>/settings?credits=cancel
- CORS_ORIGINS=https://<FRONTEND>,https://www.<FRONTEND>
- CORS_ORIGIN_REGEX=^https://([a-zA-Z0-9-]+\.)?(pages\.dev|workers\.dev|<your-domain>)$
- FRONTEND_ORIGIN / FRONTEND_URL=https://<FRONTEND>

### Stripe
- Dashboard webhook endpoint → https://<API-HOST>/api/billing/webhook
- Update after API URL is known.

## Ready commands (after Stefan confirms domain + API URL)

```powershell
cd C:\Users\shado\Desktop\Cavio\web\frontend
# set production API URL for build (example):
# $env:VITE_API_BASE_URL='https://YOUR-API.up.railway.app'
# $env:VITE_API_URL=$env:VITE_API_BASE_URL
npm run build
npx wrangler pages project create cavio --production-branch main
npx wrangler pages deploy dist --project-name=cavio --branch=main
# Custom domain: CF Dashboard → Workers & Pages → cavio → Custom domains
# THEN at Hostgate DNS: CNAME www (or app) → cavio.pages.dev  (add domain in CF UI FIRST or get 522)
```

## API redeploy (Railway example)
```powershell
cd C:\Users\shado\Desktop\Cavio
railway login   # if needed
railway init    # or link existing
railway up
# set secrets via railway variables UI / `railway variables set KEY=value`
```

## Blockers
1. Confirm custom domain (Hostgate) — not found in repo/mail/archives.
2. Recreate/link Railway (or Fly) Cavio API — not in current Railway project list.
3. Rebuild frontend with non-localhost VITE_API_*.
4. Update Stripe webhook + CORS + checkout URLs.
