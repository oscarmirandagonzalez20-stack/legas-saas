#!/bin/sh
# Railway startup — no migrations here (handled by predeploy in railway.toml).
# exec replaces sh so dumb-init forwards SIGTERM directly to the node process.
PORT="${PORT:-3000}"
echo "PORT: ${PORT}"
echo "HOST: 0.0.0.0"
echo "Healthcheck ready"
exec node dist/main.js
