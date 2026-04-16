# Security Review Pass (Task 19)

Checklist from the launch plan with current status. Re-run this before every
production deploy and on PRs that touch auth, settings, or the webhook.

---

## Checklist

| Item | Status | Evidence |
|---|---|---|
| `pnpm audit` clean or documented exceptions | Exception | Audit endpoint returns 410; `pnpm` 9.15 uses the retired endpoint. Upgrade to pnpm 10 post-launch or switch to `npm audit` in CI. No known high-severity advisories against our deps as of 2026-04-16. |
| CSP on web | Done | See `vercel.json` → `headers`. CSP allows only self-origin scripts, inline styles (required by Tailwind), Sentry ingest, and Unsplash images used in the login hero. `frame-ancestors 'none'` blocks iframe embedding. |
| Secure cookie flags | N/A | We use JWT in `localStorage` (not cookies) so secure/httpOnly flags don't apply. Tradeoff: XSS risk vs CSRF risk — we chose XSS-susceptible-but-CSRF-immune. Strict CSP is the mitigation. |
| CORS allowlist | Done | `apps/api/src/main.ts` sets `cors({ origin: env.WEB_ORIGIN, credentials: true })` — not `*`. Origin is a single URL set per environment. |
| Response-time-equal login errors | Done | Unknown-email branch runs `bcrypt.compare` against a precomputed dummy hash (TIMING_DUMMY_HASH in `apps/api/src/routes/auth.ts`) before returning 401. An attacker can't learn which emails are registered from timing. |
| Protected routes 401 without auth | Done | `requireAuth` returns `401 {"error":"unauthorized"}` on missing or invalid Bearer token. All mutating routes (`/me`, `/guests`, `/templates`, `/campaigns`, `/settings`, `/audit`, `/campaigns/:id/events`) run it. |
| 404 (not 403) on cross-tenant reads | Done | All tenant-scoped `findFirst` queries combine `eq(table.id, id)` with `eq(table.orgId, currentOrgId(c))`. Drizzle returns null → route returns 404. Additionally RLS policies (Task 2) filter at the DB layer so even a missing app-layer check would result in empty results → 404. |

---

## Additional hardening landed during Tasks 1-18

- **Env validation at boot** (Task 1) — api and worker refuse to start with
  missing/short/duplicated secrets. JWT secrets must differ in production.
- **RLS tenant isolation** (Task 2) — every tenant table has a policy keyed on
  `app.current_org` session variable set by `withTenant` middleware.
- **Refresh token rotation + reuse detection** (Task 3) — stolen refresh tokens
  are detectable on second use; reuse triggers `auth_revoke_all_for_user`.
- **Webhook HMAC verification** (Task 4) — Meta signatures validated with
  `crypto.timingSafeEqual`, raw body preserved before JSON parse.
- **Rate limiting** (Task 5) — per-IP on `/auth/*` and per-org on `/campaigns`,
  fail-open on Redis errors so an outage doesn't block the API.
- **Audit log** (Task 14) — writes for login (success + failure), register,
  campaign create, settings update, guest import, whatsapp connect.
- **Secrets at rest** (Task 12) — Meta access tokens and app secrets encrypted
  with AES-256-GCM, key derived from `SECRETS_ENCRYPTION_KEY`. Values never
  pass through the DB pool driver in plaintext after the wizard.
- **Template approval gate** (Task 7) — cloud-provider campaigns blocked from
  sending non-approved templates (Meta compliance).
- **Password complexity + verified-email gate** (Task 3) — min 8 chars,
  `requireVerified` middleware blocks campaign sends until email confirmed.

---

## Known residual risks

1. **JWT in localStorage** — vulnerable to XSS. Mitigated by strict CSP but a
   single `<script>` injection via a dependency supply-chain attack could
   exfiltrate tokens. Consider moving to httpOnly refresh-token cookies +
   short-lived in-memory access tokens in a follow-up hardening sprint.
2. **No WAF / bot detection** — a determined attacker can spin up many IPs
   to evade the per-IP auth limiter. Add Cloudflare or similar upstream when
   we see a real attack.
3. **Sample email provider (Resend) in dev falls back to console** — if
   `RESEND_API_KEY` is accidentally left unset in production, verification
   links won't send. Add a boot-time assert: fail hard if `NODE_ENV=production`
   AND `RESEND_API_KEY` missing. (Follow-up ticket.)
4. **No per-user 2FA** — operators with admin role have full tenant access.
   Add TOTP in a follow-up; the refresh-tokens table makes per-session
   revocation trivial.
5. **`settings.waConfig` stored as opaque jsonb in Drizzle** — typed at the
   schema layer (`waConfigSchema`) but not enforced at the DB layer. A direct
   psql write could bypass the shape. Acceptable for operator-only access.
6. **Audit log write failures are logged, not alerted** — a flood of write
   errors would be invisible until an operator reads pino logs. Wire a Sentry
   counter or log-based alert rule.

---

## Review sign-off

- Last review: 2026-04-16 (post-Task 19)
- Reviewer: automated sweep via Tasks 1-19 implementation
- Next review: before first production deploy with real customer data
