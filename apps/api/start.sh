#!/bin/sh
# Railway startup — migrations run via predeploy in railway.toml, not here.
# exec replaces sh so dumb-init forwards SIGTERM directly to the node process.
set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "[start.sh] Railway container boot"
echo "[start.sh] DATE=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "[start.sh] PORT=${PORT:-NOT SET}"
echo "[start.sh] NODE_ENV=${NODE_ENV:-NOT SET}"
echo "[start.sh] DATABASE_URL set=$([ -n "${DATABASE_URL}" ] && echo YES || echo NO)"
echo "[start.sh] REDIS_URL   set=$([ -n "${REDIS_URL}" ] && echo YES || echo NO)"
echo "[start.sh] Checking dist/main.js..."

if [ ! -f "dist/main.js" ]; then
  echo "[start.sh] FATAL: dist/main.js NOT FOUND — pnpm deploy may have excluded it"
  echo "[start.sh] Files in /app:"
  ls -la /app/ 2>/dev/null || true
  exit 1
fi

echo "[start.sh] dist/main.js FOUND (size=$(du -k dist/main.js | cut -f1)K)"
echo "[start.sh] Launching: exec node dist/main.js"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

exec node dist/main.js
