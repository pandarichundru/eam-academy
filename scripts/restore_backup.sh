#!/usr/bin/env bash
set -euo pipefail

# Reproducible SQL Server backup verification and restore script for EAM 11.6 vanilla backup.
# Credentials are read from MSSQL_SA_PASSWORD (never hardcoded in committed docs/output).

ARCHIVE_PATH="${1:-/Users/sainath/Downloads/116_van 1.7z}"
BACKUP_DIR="${BACKUP_DIR:-/Users/sainath/.gemini/antigravity/scratch/eam-116-backup}"
BAK_NAME="116_van.bak"
EXPECTED_BYTES="1132253184"
EXPECTED_SHA256="a7a0320bd19952328e0014dde4b7d7e69c9097d73343607b0e39870d6bfab16d"
CONTAINER_NAME="${MSSQL_CONTAINER:-eam-mssql-restore}"
DB_NAME="${MSSQL_DB:-EAM116_VAN}"
MSSQL_IMAGE="${MSSQL_IMAGE:-mcr.microsoft.com/mssql/server:2022-latest}"
MSSQL_PORT="${MSSQL_PORT:-14333}"

if [[ -z "${MSSQL_SA_PASSWORD:-}" ]]; then
  echo "ERROR: Set MSSQL_SA_PASSWORD environment variable before running." >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"
if [[ ! -f "$BACKUP_DIR/$BAK_NAME" ]]; then
  echo "Extracting $ARCHIVE_PATH to $BACKUP_DIR..."
  bsdtar -xvf "$ARCHIVE_PATH" -C "$BACKUP_DIR"
fi

ACTUAL_BYTES=$(stat -f%z "$BACKUP_DIR/$BAK_NAME" 2>/dev/null || stat -c%s "$BACKUP_DIR/$BAK_NAME")
ACTUAL_SHA256=$(shasum -a 256 "$BACKUP_DIR/$BAK_NAME" | awk '{print $1}')

if [[ "$ACTUAL_BYTES" != "$EXPECTED_BYTES" ]]; then
  echo "ERROR: Size mismatch: got $ACTUAL_BYTES, expected $EXPECTED_BYTES" >&2
  exit 1
fi
if [[ "$ACTUAL_SHA256" != "$EXPECTED_SHA256" ]]; then
  echo "ERROR: SHA-256 mismatch: got $ACTUAL_SHA256, expected $EXPECTED_SHA256" >&2
  exit 1
fi
echo "Verified $BAK_NAME: $ACTUAL_BYTES bytes, SHA-256 $ACTUAL_SHA256"

docker info >/dev/null 2>&1 || { echo "ERROR: Docker daemon is not running." >&2; exit 1; }

if ! docker ps --format '{{.Names}}' | grep -qx "$CONTAINER_NAME"; then
  docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true
  docker run -d --name "$CONTAINER_NAME" --platform linux/amd64 \
    -e "ACCEPT_EULA=Y" \
    -e "MSSQL_SA_PASSWORD=$MSSQL_SA_PASSWORD" \
    -p "${MSSQL_PORT}:1433" \
    -v "${BACKUP_DIR}:/var/opt/mssql/backup:ro" \
    "$MSSQL_IMAGE" >/dev/null
fi

SQLCMD=$(docker exec "$CONTAINER_NAME" sh -c 'ls /opt/mssql-tools18/bin/sqlcmd /opt/mssql-tools/bin/sqlcmd 2>/dev/null | head -n1')
for i in $(seq 1 30); do
  if docker exec "$CONTAINER_NAME" "$SQLCMD" -S localhost -U sa -P "$MSSQL_SA_PASSWORD" -C -Q "SELECT 1" >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

echo "Running RESTORE FILELISTONLY..."
docker exec "$CONTAINER_NAME" "$SQLCMD" -S localhost -U sa -P "$MSSQL_SA_PASSWORD" -C -s "|" -W \
  -Q "RESTORE FILELISTONLY FROM DISK = N'/var/opt/mssql/backup/${BAK_NAME}';"

echo "Restoring database [$DB_NAME]..."
docker exec "$CONTAINER_NAME" "$SQLCMD" -S localhost -U sa -P "$MSSQL_SA_PASSWORD" -C -Q "
RESTORE DATABASE [$DB_NAME]
FROM DISK = N'/var/opt/mssql/backup/${BAK_NAME}'
WITH
  MOVE N'EAM116_data'  TO N'/var/opt/mssql/data/${DB_NAME}_data.mdf',
  MOVE N'EAM116_index' TO N'/var/opt/mssql/data/${DB_NAME}_index.ndf',
  MOVE N'EAM116_log'   TO N'/var/opt/mssql/data/${DB_NAME}_log.ldf',
  REPLACE, RECOVERY, STATS = 25;
SELECT name, state_desc FROM sys.databases WHERE name = N'${DB_NAME}';
"
