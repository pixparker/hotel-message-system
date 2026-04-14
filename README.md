# Hotel Message System

Web-based WhatsApp messaging for hotel staff. Ships as a SaaS or as a single-hotel on-premises Docker bundle.

## Quick start (dev)

```bash
pnpm install
cp .env.example .env
docker compose -f deploy/docker-compose.dev.yml up -d   # postgres + redis only
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Then open http://localhost:5173.

## Structure

- `apps/web` — React SPA (Vite + Tailwind + Radix)
- `apps/api` — Hono REST + SSE + webhook receiver
- `apps/worker` — BullMQ consumer
- `apps/wa-gateway` — WhatsApp driver host (mock / cloud / baileys)
- `packages/db` — Drizzle schema + migrations + seed
- `packages/shared` — zod schemas, types, template renderer
- `packages/wa-driver` — driver interface + implementations
- `deploy/` — production `docker-compose.yml` + Caddyfile

See [docs/ui-specification.md](docs/ui-specification.md) and the approved architecture plan for details.
