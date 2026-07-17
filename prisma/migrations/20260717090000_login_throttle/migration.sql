-- Persist login throttling across application instances without storing raw IP addresses.
CREATE TABLE "LoginThrottle" (
    "key" TEXT NOT NULL,
    "failures" INTEGER NOT NULL DEFAULT 0,
    "windowStartedAt" BIGINT NOT NULL,
    "blockedUntil" BIGINT NOT NULL DEFAULT 0,
    "updatedAt" BIGINT NOT NULL,

    CONSTRAINT "LoginThrottle_pkey" PRIMARY KEY ("key")
);

CREATE INDEX "LoginThrottle_updatedAt_idx" ON "LoginThrottle"("updatedAt");
