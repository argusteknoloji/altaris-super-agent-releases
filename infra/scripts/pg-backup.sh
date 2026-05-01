#!/bin/sh
# Daily Postgres dump with rotation. Runs inside altaris-pg-backup container.
# Output: /backups/altaris-YYYYMMDD-HHMMSS.sql.gz
# Retention: $RETENTION_DAYS (default 14)

set -eu

ts=$(date -u +%Y%m%d-%H%M%S)
out="/backups/altaris-${ts}.sql.gz"
mkdir -p /backups

echo "[$(date -u +%FT%TZ)] altaris-pg-backup → $out"
pg_dump --no-owner --no-acl --clean --if-exists --quote-all-identifiers \
  | gzip -9 > "$out"

# Verify dump is non-trivial
size=$(stat -c%s "$out" 2>/dev/null || stat -f%z "$out")
if [ "${size:-0}" -lt 1024 ]; then
  echo "[$(date -u +%FT%TZ)] ❌ dump suspiciously small ($size bytes) — keeping but flagging"
fi

# Rotate: delete dumps older than RETENTION_DAYS
days=${RETENTION_DAYS:-14}
find /backups -name "altaris-*.sql.gz" -type f -mtime +"$days" -delete
echo "[$(date -u +%FT%TZ)] ✓ done · retained last ${days}d"
