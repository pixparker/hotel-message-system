-- Task 7: Template approval workflow.
-- Tracks Meta's approval status for each template so campaign create can
-- block on non-approved templates when provider = cloud.

CREATE TYPE "template_approval_status" AS ENUM ('draft', 'pending', 'approved', 'rejected');
--> statement-breakpoint

ALTER TABLE "templates"
  ADD COLUMN "external_name" text,
  ADD COLUMN "approval_status" "template_approval_status" NOT NULL DEFAULT 'draft',
  ADD COLUMN "last_synced_at" timestamptz;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "templates_org_approval_idx"
  ON "templates"("org_id", "approval_status");
