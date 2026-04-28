# Hotel Message System

Web-based WhatsApp messaging for hotel staff. Ships as a SaaS or as a single-hotel on-premises Docker bundle.

## Quick start (dev)

```bash
pnpm install
cp .env.example .env
pnpm dev:setup       # postgres + redis + migrate + seed (first time)
pnpm dev             # api + worker + web in parallel
```

Then open http://localhost:5173.

Handy helpers:

```bash
pnpm services:up      # start postgres + redis
pnpm services:down    # stop them (data preserved in volumes)
pnpm services:reset   # nuke volumes and start clean — re-run dev:setup after
pnpm services:logs    # tail postgres + redis logs
pnpm db:psql          # shell into the dev database
```

## Structure

- `apps/web` — React SPA (Vite + Tailwind + Radix)
- `apps/api` — Hono REST + SSE + webhook receiver
- `apps/worker` — BullMQ consumer
- `apps/wa-gateway` — WhatsApp driver host (mock / cloud / baileys)
- `packages/db` — Drizzle schema + migrations + seed
- `packages/shared` — zod schemas, types, template renderer
- `packages/wa-driver` — driver interface + implementations
- `deploy/` — production `docker-compose.yml` + Caddyfile

See [docs/ROADMAP.md](docs/ROADMAP.md) for current direction, [docs/ui-specification.md](docs/ui-specification.md) for UX, and [docs/plans/architecture-decisions.md](docs/plans/architecture-decisions.md) for locked tech decisions.
