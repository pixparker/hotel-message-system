# Deploy (on-premises)

## First-time install

```bash
cd deploy
cp .env.example .env    # edit secrets + SITE_DOMAIN
docker compose build
docker compose up -d

# Apply migrations + seed the first org/admin (runs in the api container):
docker compose exec api node --eval "await import('/app/packages/db/dist/migrate.js')" \
  || docker compose run --rm api pnpm --filter @hms/db migrate
docker compose run --rm api pnpm --filter @hms/db seed
```

Open `https://$SITE_DOMAIN` and sign in with the credentials in `.env`.

## Upgrade

```bash
git pull
docker compose build
docker compose up -d
docker compose run --rm api pnpm --filter @hms/db migrate
```

## Backup

```bash
docker compose exec postgres pg_dump -U hms hms > backup-$(date +%F).sql
```
