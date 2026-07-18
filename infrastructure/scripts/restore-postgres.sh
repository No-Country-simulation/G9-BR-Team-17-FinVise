#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

cd "${PROJECT_ROOT}"

# shellcheck source=/dev/null
source .env

BACKUP_DIR="${PROJECT_ROOT}/backups"

if [[ $# -lt 1 ]]; then
    echo "Usage: $0 <backup_file.sql.gz>"
    echo "Available backups:"
    ls -1 "${BACKUP_DIR}"/*.sql.gz 2>/dev/null || echo "  (none)"
    exit 1
fi

BACKUP_FILE="$1"

if [[ ! -f "${BACKUP_FILE}" ]]; then
    echo "Backup file not found: ${BACKUP_FILE}"
    exit 1
fi

echo "=== Restoring PostgreSQL from ${BACKUP_FILE} ==="
gunzip -c "${BACKUP_FILE}" | docker exec -i financeai-postgres psql \
    -U "${POSTGRES_USER:-financeai}" \
    -d "${POSTGRES_DB:-financeai}"

echo "=== Restore complete ==="
