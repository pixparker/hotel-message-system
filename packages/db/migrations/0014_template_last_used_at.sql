-- Track when each template was last used on a real (non-test) send so the
-- Send-wizard template picker can surface recently-used templates first.

ALTER TABLE "templates"
  ADD COLUMN "last_used_at" timestamptz;
