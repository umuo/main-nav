#!/bin/sh
set -e

# Apply database migrations when a database is configured.
# Skipped automatically if DATABASE_URL is unset (embedded PGlite mode is dev-only).
if [ -n "$DATABASE_URL" ]; then
  echo "[entrypoint] Applying database migrations (prisma migrate deploy)..."
  ./node_modules/.bin/prisma migrate deploy
else
  echo "[entrypoint] DATABASE_URL not set — skipping migrations."
fi

echo "[entrypoint] Starting server..."
exec "$@"
