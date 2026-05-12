#!/bin/sh
# Railway startup — migrations run via predeploy in railway.toml, not here.
# exec replaces sh so dumb-init forwards SIGTERM directly to the node process.
PORT="${PORT:-3000}"
echo "PORT: ${PORT}"
echo "HOST: 0.0.0.0"
echo "[startup] Launching NestJS..."
exec node dist/main.js
