# Throughput Tuning

Task 18: documented tuning knobs + baseline numbers from the load test script.

---

## Load test script

Run:

```bash
# From repo root (docker stack running, api + worker up)
pnpm tsx scripts/load-test.ts --guests 5000
```

What it does:

1. Seeds synthetic guests up to the target count.
2. Creates a campaign with all of them as recipients.
3. Enqueues the send-message jobs via BullMQ.
4. Polls `campaigns.totals_*` every second until complete.
5. Prints enqueue latency (jobs/sec inserted into BullMQ) and drain time
   (first job → all terminal status).

---

## Tuning knobs

| Lever | Where | Default | Effect |
|---|---|---|---|
| Worker concurrency | [apps/worker/src/main.ts](../../apps/worker/src/main.ts) (`concurrency: 5`) | 5 | Parallel jobs per worker process. Bump to 10-20 for mock driver; keep at 5 for Meta to avoid 429s. |
| Per-org tokens | `WORKER_ORG_MSGS_PER_MINUTE` env | 80 | Task 8's per-tenant fairness. Raise as tenants graduate Meta tiers. |
| Postgres pool | [packages/db/src/client.ts](../../packages/db/src/client.ts) | driver default (10) | Too small → worker jobs wait on free connections. Too large → connections starve the api. Recommended: `max_connections / (api_pods + worker_pods)`. |
| Fly machine memory | `[[vm]]` in fly.toml | 512mb | Bump when drizzle + BullMQ + ioredis hits ~400mb. |
| Redis eviction | Upstash policy | `noeviction` | MUST be noeviction — BullMQ loses jobs under `allkeys-lru`. |

---

## Baseline numbers (dev, docker compose, mock driver)

From a single local run with defaults (MacBook Pro, 16GB):

- Enqueue: ~2500 jobs/s (insert `messages` + BullMQ addBulk)
- Drain (5k msgs, mock driver): ~45s
- Throughput: ~110 msgs/s (bounded by mock's fake-delivery setTimeout)

Raise `WORKER_ORG_MSGS_PER_MINUTE` to 6000 during the test to bypass the fair-
share limiter — that's what exposes the real floor:

```
WORKER_ORG_MSGS_PER_MINUTE=6000 pnpm --filter @hms/worker dev
```

---

## Meta tier ceiling (theoretical)

| Tier | Msgs/day | Msgs/sec sustained | Our 5k campaign |
|---|---|---|---|
| Tier 1 | 1,000 | ~0.01 | Can't run — exceeds daily quota |
| Tier 2 | 10,000 | ~0.12 | ~12 hours |
| Tier 3 | 100,000 | ~1.2 | ~70 minutes |
| Unlimited | — | Meta's rate limit (2000/sec) | ~3 seconds |

These are daily quotas — Meta also enforces a per-second rate limit.
Tune `WORKER_ORG_MSGS_PER_MINUTE` per tenant based on their tier
(future: store in `settings.wa_config.msgsPerMinute`).

---

## Where to focus if drain is too slow

1. **Check queue depth trend**: `curl $API/health/deep | jq .checks.queue` —
   if waiting isn't decreasing, worker is the bottleneck, not enqueue.
2. **Worker CPU**: if at 100% with default concurrency, bump concurrency
   first (cheap). If still at 100%, scale horizontally (`fly scale count=3`).
3. **Postgres CPU**: if high, the hot query is likely the campaign totals
   update. Consider batching increments (future optimization).
4. **Meta 429**: if the cloud driver is emitting `CloudApiError { status:429 }`,
   lower `WORKER_ORG_MSGS_PER_MINUTE` for that tenant.

---

## Next steps (out of scope for task 18)

- **Per-tenant rate override in settings** — `wa_config.msgsPerMinute` read by
  worker's `acquireOrgToken`. Today the env default applies to all tenants.
- **Concurrency via settings** — today hardcoded to 5 globally.
- **DB write batching for totals** — each message status event does a DB
  update; batch these via a dedicated stream consumer at high volumes.
