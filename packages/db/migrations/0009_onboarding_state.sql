-- Task 11: Track onboarding state for the dashboard checklist.
-- Jsonb so we can add new checklist items without migrations.

ALTER TABLE "organizations"
  ADD COLUMN "onboarding_state" jsonb NOT NULL DEFAULT '{}'::jsonb;
