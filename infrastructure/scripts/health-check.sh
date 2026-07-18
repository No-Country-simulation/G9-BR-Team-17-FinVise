#!/usr/bin/env bash
set -euo pipefail

NGINX_URL="${NGINX_URL:-http://localhost:8080}"
BACKEND_URL="${BACKEND_URL:-http://localhost:8080}"
AI_URL="${AI_URL:-http://localhost:8000}"

check() {
    local name="$1"
    local url="$2"
    local path="$3"
    if curl -fs "${url}${path}" > /dev/null 2>&1; then
        echo "[OK] ${name} at ${url}${path}"
    else
        echo "[FAIL] ${name} at ${url}${path}"
        return 1
    fi
}

echo "=== Health Check ==="
check "Nginx" "${NGINX_URL}" "/health" || true
check "Backend Actuator" "${BACKEND_URL}" "/actuator/health" || true
check "AI Service" "${AI_URL}" "/health" || true
