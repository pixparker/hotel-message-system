-- Modules system + automation origin tagging.
-- - settings.modules: per-workspace JSON state for opt-in modules. The first
--   module is "check_in", which holds the auto check-in / check-out message
--   config (enabled flag + template id). Stored as JSONB so each module can
--   evolve its own shape without schema churn.
-- - campaigns.origin: distinguishes manual user-initiated sends from
--   automation-triggered sends so reports can tag/filter them. Default
--   "manual" keeps existing rows correct.

ALTER TABLE "settings"
  ADD COLUMN "modules" jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE TYPE "campaign_origin" AS ENUM (
  'manual',
  'auto_check_in',
  'auto_check_out'
);

ALTER TABLE "campaigns"
  ADD COLUMN "origin" "campaign_origin" NOT NULL DEFAULT 'manual';

CREATE INDEX "campaigns_org_origin_idx" ON "campaigns" ("org_id", "origin");
