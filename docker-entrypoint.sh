#!/bin/sh
set -e

# Apply database migrations when a database is configured.
# Skipped automatically if DATABASE_URL is unset (embedded PGlite mode is dev-only).
if [ -n "$DATABASE_URL" ]; then
  echo "[entrypoint] Applying database migrations (prisma migrate deploy)..."
  # Invoke the Prisma CLI directly via node (not through node_modules/.bin/prisma).
  # Prisma 7's CLI resolves its WASM engines (prisma_schema_build_bg.wasm,
  # schema_engine_bg.wasm) relative to __dirname, which is node_modules/prisma/build/
  # — exactly where they live. A copied .bin shim would point __dirname at .bin/
  # (no sibling wasm) and crash with ENOENT.
  node ./node_modules/prisma/build/index.js migrate deploy
else
  echo "[entrypoint] DATABASE_URL not set — skipping migrations."
fi

echo "[entrypoint] Starting server..."
exec "$@"
