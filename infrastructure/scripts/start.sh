#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

cd "${PROJECT_ROOT}"

echo "=== Starting FinVise ==="

if [[ ! -f .env ]]; then
    echo ".env file not found. Creating from .env.example..."
    cp .env.example .env
    echo "Please edit .env with real values before production."
fi

docker compose -f docker-compose.yml up -d

echo "=== Waiting for services ==="
sleep 5
bash "${SCRIPT_DIR}/health-check.sh"

echo "=== FinVise started ==="
echo "Local URL: http://localhost:8080"
