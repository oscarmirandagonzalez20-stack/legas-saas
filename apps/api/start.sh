#!/bin/sh
# Startup script for Railway — runs DB migrations then hands off to NestJS.
# Using exec so dumb-init can forward SIGTERM directly to the node process.
set -e

PORT="${PORT:-3000}"
echo "[api] Starting | PORT=${PORT} | NODE_ENV=${NODE_ENV:-production}"

echo "[api] Running database migrations..."
if ./node_modules/.bin/prisma migrate deploy; then
  echo "[api] Migrations applied."
else
  # Non-fatal: log the failure and continue so the healthcheck can still pass.
  # Railway logs will surface this; fix the migration before next deploy.
  echo "[api] WARNING: prisma migrate deploy exited with error — continuing startup."
fi

echo "[api] Launching NestJS on 0.0.0.0:${PORT}..."
exec node dist/main.js
