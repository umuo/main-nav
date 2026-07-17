-- Preserve structured server probe diagnostics for the public status view.
ALTER TABLE "Website"
ADD COLUMN "serverStatusCode" INTEGER,
ADD COLUMN "serverReason" TEXT;
