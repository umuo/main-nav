-- The original schema used INTEGER, which cannot hold JavaScript millisecond timestamps.
ALTER TABLE "Website"
ALTER COLUMN "lastChecked" TYPE BIGINT USING "lastChecked"::BIGINT;

CREATE INDEX "Website_categoryId_idx" ON "Website"("categoryId");
