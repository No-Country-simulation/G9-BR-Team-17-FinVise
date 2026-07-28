#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

cd "${PROJECT_ROOT}"

# shellcheck source=/dev/null
source .env

BACKUP_DIR="${PROJECT_ROOT}/backups"
mkdir -p "${BACKUP_DIR}"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/finvise_backup_${TIMESTAMP}.sql.gz"

echo "=== Backing up PostgreSQL ==="
docker exec finvise-postgres pg_dump \
    -U "${POSTGRES_USER:-finvise}" \
    -d "${POSTGRES_DB:-finvise}" \
    --clean --if-exists | gzip > "${BACKUP_FILE}"

echo "Backup saved to: ${BACKUP_FILE}"
