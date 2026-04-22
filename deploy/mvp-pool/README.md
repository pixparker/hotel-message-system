# Clientora MVP Pool

A thin, Docker-Compose-based framework for hosting several MVPs on one server
and lifting any of them to dedicated infrastructure when they graduate.

## Why it exists

- One VPS, N MVPs, isolated per project.
- Provider-agnostic — deploys the same way on Hetzner, any other VPS, or a local box.
- CLI-first; no portal, no SaaS lock-in.
- Every MVP gets its own database, user, Redis DB slot, domain, env file, and compose stack.
- Extraction to a dedicated host is a `pg_dump | pg_restore` + compose copy away.

## Layout

```
/srv/
├── infra/                           # shared per-server
│   ├── compose.yaml                  # Caddy + Postgres + Redis
│   ├── .env                          # admin creds, ACME email
│   ├── Caddyfile                     # imports sites/*.caddy
│   ├── sites/<mvp>.caddy             # one per MVP (auto-generated)
│   └── backups/
└── apps/
    └── <mvp>/                        # one directory per MVP
        ├── repo/                     # git clone of the MVP's source
        ├── .env                      # per-MVP secrets (mode 600)
        ├── .meta                     # domain, db_name, redis_db, etc.
        └── backups/                  # per-MVP pg_dump archives
```

Shared Docker networks:
- `clientora_edge` — Caddy ↔ MVP web/api
- `clientora_data` — Postgres/Redis ↔ MVP api/worker

## First-time server setup

```bash
# (one time, as root)
git clone <this-repo> /opt/clientora
sudo bash /opt/clientora/deploy/mvp-pool/bootstrap.sh

# (as a non-root user with docker access)
clientora infra:install          # /srv/infra + generated admin creds
$EDITOR /srv/infra/.env          # set ACME_EMAIL
clientora infra:up               # start shared Caddy + Postgres + Redis
```

## Add an MVP

```bash
clientora mvp:add hotel-message \
  --domain reform-hotel.clientora.net \
  --repo git@github.com:pixparker/hotel-message-system.git \
  --branch main

clientora deploy hotel-message
```

That's it. The CLI:
1. creates Postgres role + database with a generated password,
2. picks the next free Redis DB index (0–15),
3. clones the repo,
4. generates `.env` with fresh JWT + encryption secrets,
5. writes a Caddy site snippet binding the domain to the MVP's web + api containers,
6. builds images, runs migrations, brings services up,
7. reloads Caddy (zero downtime; TLS issued via Let's Encrypt on first hit).

## Deploy after a code change

```bash
clientora deploy hotel-message
```

Runs from the server; `git fetch + reset --hard origin/$BRANCH` + build + migrate + up + `caddy reload`.

From a laptop, use the wrapper:

```bash
# one-time
ln -sf $(pwd)/deploy/mvp-pool/bin/clientora-local ~/.local/bin/clientora
echo 'CLIENTORA_HOST=ali@ssh.clientora.net' > ~/.config/clientora/config

# then
clientora deploy hotel-message
```

## Day-2 ops

| Need                     | Command                                       |
|--------------------------|------------------------------------------------|
| live logs                | `clientora logs <mvp> [service]`              |
| restart a service        | `clientora restart <mvp> [service]`           |
| DB shell                 | `clientora db:psql <mvp>`                     |
| manual backup            | `clientora db:backup <mvp>`                   |
| restore dump             | `clientora db:restore <mvp> <path>`           |
| roll back one commit     | `clientora rollback <mvp>`                    |
| roll back to any ref     | `clientora rollback <mvp> <git-ref>`          |
| list MVPs                | `clientora mvp:list`                          |
| everything at a glance   | `clientora status`                            |

## Adding a second MVP

Per-MVP repo contract:

1. A Compose file at `deploy/compose.mvp-pool.yaml` (or any path passed via `--compose-file`)
   that declares `api`, `web`, `worker` (or whatever services you have) and joins the
   external networks `clientora_edge` and `clientora_data`.
2. `env_file: ../.env` on each service.
3. A build context that produces images which:
   - expose HTTP on the port declared in `.meta` (`API_PORT`, `WEB_PORT`),
   - connect to Postgres at hostname `postgres` and Redis at `redis`,
   - include an entry point that can run migrations (the CLI calls `node_modules/.bin/tsx packages/db/src/migrate.ts` for the hotel-message repo — override via the compose `run` step in a PR if the pattern differs).

Then on the server:

```bash
clientora mvp:add project-b \
  --domain project-b.clientora.net \
  --repo git@github.com:you/project-b.git
clientora deploy project-b
```

Add the DNS A-record (`project-b.clientora.net → <server IP>`) in Cloudflare before the first deploy.

## Extracting an MVP to dedicated infrastructure

The MVP is already 95% portable:

```bash
# on current server
clientora db:backup <mvp>

# move the directory + dump to the new host
rsync -a /srv/apps/<mvp>/ newhost:/srv/apps/<mvp>/

# on new host
clientora infra:install && $EDITOR /srv/infra/.env && clientora infra:up
clientora db:restore <mvp> /srv/apps/<mvp>/backups/<latest>.sql.gz
clientora deploy <mvp>
```

Because nothing is specific to Hetzner, this works against any Linux VPS.

## What's shared vs dedicated

| Shared (one per server) | Dedicated (one per MVP) |
|--------------------------|--------------------------|
| Caddy + TLS              | App containers           |
| PostgreSQL server        | Postgres **database + role** |
| Redis server             | Redis **DB index**       |
| Docker networks          | Domain, env file, meta   |

Graduate any dedicated item by moving it off the shared resource — the CLI's
extraction recipe above already does this for DB and data.

## Security notes

- All per-MVP `.env` and `.meta` files are mode 600.
- Postgres and Redis listen only on `127.0.0.1` plus the private Docker network.
- Caddy terminates TLS and sets HSTS by default.
- Firewall (UFW) is set to allow only 22, 80, 443 inbound.
- Secrets are generated with `openssl rand` at `mvp:add` time, never committed.
