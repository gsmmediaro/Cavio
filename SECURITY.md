# Security and data-protection notes

Cavio / Dentando analyzes dental radiographs for caries screening.
Treat every uploaded image as **health data**.

This document is operational guidance, not legal advice.

## What this deployment protects

The FastAPI backend (`web/backend`) applies:

- Per-IP burst and daily limits on `/api/analyze`
- Per-clinic daily caps for signed trial tokens (default **5 / day**)
- Per-API-key and per-authenticated-user quotas when those credentials exist
- Upload size, MIME/magic, and dimension checks
- Inference timeout and concurrency cap
- CORS allowlist (localhost by default)
- Public model **ids** only (no filesystem paths)
- Safe error messages (no stack traces or weight paths)
- Audit logs with hashed IPs / actor ids — never raw patient names,
  filenames, or image bytes
- Annotated results stored as re-encoded JPEGs (**EXIF stripped**)
  under unguessable names; path traversal is rejected

## Radiographs are health data

Dental X-rays are special-category personal data under **EU GDPR**
(Art. 9). Romania (RO) applies GDPR plus national health-data rules.

**HIPAA** applies only if you handle US protected health information
(PHI) as a covered entity or business associate. A Romania-only
pilot is not automatically HIPAA-covered. If any US clinic or
patient data is in scope, complete a BA agreement and HIPAA review
before go-live.

## Recommended controls before a clinic pilot

1. **DPA** — Sign a Data Processing Agreement with each clinic
   (controller) naming Cavio as processor. Document purposes:
   inference for screening support, not model training.
2. **Legal basis** — Typically Art. 6 (contract / legitimate interest)
   plus Art. 9 (explicit consent or health-care provision under
   Member State law). Confirm with counsel.
3. **Retention** — Default `RESULTS_TTL_HOURS=24`. Delete annotated
   results and any clinic-side copies after the pilot. Do not keep
   originals on the inference host.
4. **Encryption** — TLS in transit (reverse proxy). Encrypt disks /
   object storage at rest. Restrict SSH and cloud IAM.
5. **No training on customer scans** without documented, informed
   consent and a separate legal basis. Default: inference only.
6. **Access** — Issue `API_KEYS` or clinic trial tokens. Set
   `REQUIRE_AUTH=true` in production. Rotate secrets after the pilot.
7. **Subprocessors** — List hosting (e.g. Railway), frontend host
   (e.g. Vercel), and Firebase if auth/history is enabled. Update
   the privacy notice.
8. **Subject rights** — Provide a delete path for stored scans
   (Firestore history + result images). Audit logs must stay
   non-identifying (hashes only).

## Local development

Leave `REQUIRE_AUTH` unset/false, keep `CORS_ORIGINS` on localhost,
and omit `API_KEYS` / `TRIAL_TOKEN_SECRET`. Rate limits still apply
so a runaway loop cannot flood inference.

```bash
# backend
python -m web.backend.serve

# frontend (Vite proxies /api and /static to localhost:8000)
cd web/frontend && npm run dev
```

## Production configuration

See `.env.example` for every limit. Typical production set:

| Variable | Suggested |
| --- | --- |
| `CORS_ORIGINS` | Exact frontend origin(s), no `*` |
| `CORS_ORIGIN_REGEX` | Empty unless you need Vercel previews |
| `REQUIRE_AUTH` | `true` |
| `TRIAL_TOKEN_SECRET` | Long random secret |
| `API_KEYS` | Per-clinic keys, or empty if tokens-only |
| `TRIAL_SCANS_PER_DAY` | `5` for the free pilot |
| `MAX_UPLOAD_MB` | `15` |
| `MAX_IMAGE_PX` | `8192` |
| `INFERENCE_TIMEOUT_S` | `45` |
| `MAX_CONCURRENT_INFERENCES` | `2` (raise only if GPU allows) |
| `RESULTS_TTL_HOURS` | `24` or less |

Mint a trial token:

```bash
export TRIAL_TOKEN_SECRET=...
python scripts/mint_trial_token.py --clinic clinic-nord --days 30
```

Send it as `X-Trial-Token`. Optional frontend:
`VITE_TRIAL_TOKEN` / `VITE_API_KEY`.

Firebase ID tokens (`Authorization: Bearer`) are used as a
**rate-limit and audit key** only; they are not verified here.
`REQUIRE_AUTH=true` accepts only `API_KEYS` or signed trial
tokens. Do not treat an unverified bearer token as proof of
identity.

## What we do not log

- Patient names (the form field is ignored server-side)
- Original filenames in audit lines
- Image bytes or pixels
- Model filesystem paths
- Raw IPs (hashed with `AUDIT_HASH_SALT`)

## Incident notes

If a radiograph is stored longer than intended, delete
`web/backend/static/results/` and rotate `TRIAL_TOKEN_SECRET` /
`API_KEYS`. Notify clinics per the DPA.
