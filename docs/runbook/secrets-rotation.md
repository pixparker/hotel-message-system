# Runbook — Secrets rotation

How to rotate every secret the stack consumes. Follow this once on the cutover from the demo to production, and again on any suspected leak.

Secrets are validated at boot by [packages/shared/src/env.ts](../../packages/shared/src/env.ts). If a required value is missing or malformed, api and worker exit with a non-zero code and print the offending field.

## Where secrets live

| Environment | Source of truth |
| --- | --- |
| Local dev | `.env` at repo root (gitignored) |
| Staging / production | Platform secret store (Fly secrets for api+worker; Vercel env vars for web). **Never** `.env` in prod images. |

## Secrets to rotate

| Name | Scope | How to generate |
| --- | --- | --- |
| `JWT_ACCESS_SECRET` | Invalidates all active access tokens | `openssl rand -base64 48` |
| `JWT_REFRESH_SECRET` | Invalidates all refresh tokens (users re-login) | `openssl rand -base64 48` (must differ from access) |
| `DATABASE_URL` | DB connection string | Rotate in Neon; copy the new URL |
| `REDIS_URL` | Redis connection string | Rotate in Upstash; copy the new URL |
| `WA_CLOUD_ACCESS_TOKEN` | Meta system-user token | Regenerate in Meta Business Manager → System Users |
| `WA_CLOUD_VERIFY_TOKEN` | Meta webhook verify token | Any random string; must match what's set in Meta webhook config |
| `BOOTSTRAP_ADMIN_PASSWORD` | First-run admin | `openssl rand -base64 24` (removed at task 11) |

## Cutover procedure (first time, demo → prod)

1. Rotate every row in the table above. Treat the demo values as compromised — they lived in git.
2. `fly secrets set JWT_ACCESS_SECRET=... JWT_REFRESH_SECRET=... DATABASE_URL=... REDIS_URL=... WA_CLOUD_ACCESS_TOKEN=... WA_CLOUD_VERIFY_TOKEN=... --app <api-app>` (and again for `--app <worker-app>`).
3. Deploy. Fly release phase runs migrations before traffic flips.
4. Confirm `/health` returns 200; confirm logs show no `EnvValidationError`.
5. Force all users to re-login (the rotated JWT secrets invalidate prior tokens automatically).

## Regular rotation (quarterly or on incident)

1. Announce a short window — refresh-token rotation forces re-login.
2. Generate new values, push via `fly secrets set`.
3. Fly restarts api + worker automatically. Watch Sentry for a 5-minute window.
4. Update this runbook with the rotation date.

## Validating locally

```sh
# Refuse to start with a short JWT secret:
JWT_ACCESS_SECRET=short pnpm --filter @hms/api dev
# → EnvValidationError: JWT_ACCESS_SECRET: must be at least 32 characters

# Refuse to start with no DATABASE_URL:
unset DATABASE_URL; pnpm --filter @hms/api dev
# → EnvValidationError: DATABASE_URL: Required
```

## History hygiene

The repo currently has demo-value JWT secrets in its git history. Our policy is **rotate, don't rewrite history** — the demo values are short and never saw production traffic. After cutover, the only defense that matters is the rotation above. If a real production secret is ever committed, file an incident and rewrite history (BFG or `git filter-repo`) on top of rotation.
