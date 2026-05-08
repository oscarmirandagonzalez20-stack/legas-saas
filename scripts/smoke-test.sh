#!/usr/bin/env bash
# smoke-test.sh — post-deploy health verification
#
# Usage:
#   ./scripts/smoke-test.sh https://api.example.com
#   API_URL=https://api.example.com ./scripts/smoke-test.sh
#
# Exit 0 on success, 1 on any failure. Suitable for CI/CD pipelines.

set -euo pipefail

API_URL="${1:-${API_URL:-http://localhost:4000}}"
TIMEOUT=10
PASS=0
FAIL=0

GREEN='\033[0;32m'
RED='\033[0;31m'
RESET='\033[0m'

check() {
  local label="$1"
  local url="$2"
  local expected_status="${3:-200}"
  local expected_body="${4:-}"

  local response
  local http_code

  http_code=$(curl -s -o /tmp/smoke_body -w "%{http_code}" \
    --max-time "$TIMEOUT" \
    --retry 3 --retry-delay 2 \
    "$url") || true

  local body
  body=$(cat /tmp/smoke_body 2>/dev/null || echo "")

  if [[ "$http_code" != "$expected_status" ]]; then
    echo -e "${RED}✗ FAIL${RESET} $label — expected HTTP $expected_status, got $http_code"
    ((FAIL++))
    return
  fi

  if [[ -n "$expected_body" && "$body" != *"$expected_body"* ]]; then
    echo -e "${RED}✗ FAIL${RESET} $label — body did not contain: $expected_body"
    echo "  Body: $body"
    ((FAIL++))
    return
  fi

  echo -e "${GREEN}✓ PASS${RESET} $label (HTTP $http_code)"
  ((PASS++))
}

echo ""
echo "── Smoke tests → $API_URL ──"
echo ""

# Liveness: always 200 when process is up
check "GET /health/live"  "$API_URL/health/live"  200

# Readiness: 200 when DB + queue reachable; 503 if degraded
check "GET /health/ready" "$API_URL/health/ready" 200 '"status":"ok"'

echo ""
echo "── Results: ${PASS} passed, ${FAIL} failed ──"
echo ""

if [[ $FAIL -gt 0 ]]; then
  exit 1
fi
