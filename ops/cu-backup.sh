#!/usr/bin/env bash
# =============================================================================
# Collections.Ultimate — backup driver
# =============================================================================
# Three things in this system can be permanently lost:
#   1. the SQL Server database
#   2. the api_uploads volume (cover photos — the ONLY data not re-fetchable
#      from any external API)
#   3. /opt/collections~/.env (the only copy of SA_PASSWORD; without it every
#      .bak is a brick)
# Everything else is derivable from those three plus source control.
#
# PREREQUISITES (one-time, see ops/README.md):
#   - docker-compose.prod.yml sqlserver service has:  - /opt/cu/backups:/backups
#   - database is in FULL recovery model (required for log backups / PITR)
#   - /opt/cu/backup.env exists, chmod 600, containing the vars listed below
#   - restic repo initialised against a B2 bucket with an APPEND-ONLY key
#
# USAGE:  cu-backup.sh {full|diff|log|uploads}
# =============================================================================

set -Eeuo pipefail

MODE="${1:-}"
case "$MODE" in
    full|diff|log|uploads) ;;
    *) echo "usage: $0 {full|diff|log|uploads}" >&2; exit 2 ;;
esac

# --- Config ------------------------------------------------------------------
# shellcheck disable=SC1091
source /opt/cu/backup.env   # SA_PASSWORD, RESTIC_REPOSITORY, RESTIC_PASSWORD,
                            # B2_ACCOUNT_ID, B2_ACCOUNT_KEY, HC_URL, DB_NAME,
                            # SQL_CONTAINER, UPLOADS_VOLUME

: "${DB_NAME:=CollectionsUltimate}"
: "${SQL_CONTAINER:=cu-sqlserver}"
: "${BACKUP_DIR:=/opt/cu/backups}"

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
LOG_PREFIX="[cu-backup:${MODE}:${STAMP}]"

# --- Dead-man's switch -------------------------------------------------------
# The real failure mode is not corruption. It is the backup silently stopping
# four months ago and nobody noticing. Any non-zero exit pings /fail.
on_error() {
    local rc=$?
    echo "${LOG_PREFIX} FAILED (exit ${rc}) at line ${BASH_LINENO[0]}" >&2
    [ -n "${HC_URL:-}" ] && curl -fsS -m 10 --retry 3 "${HC_URL}/fail" >/dev/null 2>&1 || true
    exit "$rc"
}
trap on_error ERR

log() { echo "${LOG_PREFIX} $*"; }

sqlcmd_exec() {
    docker exec -i "$SQL_CONTAINER" /opt/mssql-tools18/bin/sqlcmd \
        -S localhost -U sa -P "$SA_PASSWORD" -C -b -Q "$1"
}

# --- Backup modes ------------------------------------------------------------
backup_database() {
    # NOTE: no WITH COMPRESSION. SQL Server Express rejects it outright:
    #   Msg 1844 — "BACKUP DATABASE WITH COMPRESSION is not supported on Express Edition"
    # restic dedupes and compresses on the way to the offsite repo anyway, so the
    # only cost is transient local disk. Re-enable if this ever runs on Standard.
    local kind="$1" ext file sql
    case "$kind" in
        full) ext="bak"; sql="BACKUP DATABASE [${DB_NAME}] TO DISK='%FILE%' WITH INIT, CHECKSUM, STATS=10;" ;;
        diff) ext="bak"; sql="BACKUP DATABASE [${DB_NAME}] TO DISK='%FILE%' WITH DIFFERENTIAL, INIT, CHECKSUM, STATS=10;" ;;
        log)  ext="trn"; sql="BACKUP LOG [${DB_NAME}] TO DISK='%FILE%' WITH INIT, CHECKSUM;" ;;
    esac
    file="/backups/${kind}_${STAMP}.${ext}"

    log "writing ${file}"
    sqlcmd_exec "${sql//%FILE%/$file}"

    # A backup that has not been verified is a file, not a backup.
    log "verifying ${file}"
    sqlcmd_exec "RESTORE VERIFYONLY FROM DISK='${file}' WITH CHECKSUM;"
}

backup_uploads() {
    local archive="${BACKUP_DIR}/uploads_${STAMP}.tar.gz"
    : "${UPLOADS_VOLUME:?UPLOADS_VOLUME must be set (docker volume ls -q | grep api_uploads)}"

    log "archiving volume ${UPLOADS_VOLUME}"
    docker run --rm \
        -v "${UPLOADS_VOLUME}:/data:ro" \
        -v "${BACKUP_DIR}:/backup" \
        alpine tar czf "/backup/uploads_${STAMP}.tar.gz" -C /data .

    # ---- The check nobody runs -------------------------------------------
    # The database and the images are backed up by two unrelated mechanisms.
    # A .bak contains ZERO image bytes — it stores only path strings. So the
    # two can drift silently, and this is exactly where the project bleeds.
    log "cross-checking DB cover references against archived files"
    local refs have missing
    refs="$(mktemp)"; have="$(mktemp)"
    trap 'rm -f "$refs" "$have"' RETURN

    docker exec -i "$SQL_CONTAINER" /opt/mssql-tools18/bin/sqlcmd \
        -S localhost -U sa -P "$SA_PASSWORD" -C -b -h -1 -W -s "|" -Q \
        "SET NOCOUNT ON;
         SELECT CustomCoverUrl FROM dbo.LibraryItem WHERE CustomCoverUrl LIKE '/uploads/%'
         UNION ALL
         SELECT CoverImageUrl  FROM dbo.Edition     WHERE CoverImageUrl  LIKE '/uploads/%';" \
        | sed 's#^/uploads/#./#' | grep -E '^\./' | sort -u > "$refs" || true

    tar tzf "$archive" | sort -u > "$have"

    missing="$(comm -23 "$refs" "$have" | wc -l)"
    if [ "$missing" -ne 0 ]; then
        log "ERROR: ${missing} cover reference(s) in the database have no file in the archive"
        comm -23 "$refs" "$have" | head -20 >&2
        return 1
    fi
    log "cover reference check passed ($(wc -l < "$refs") references)"
}

# --- Run ---------------------------------------------------------------------
mkdir -p "$BACKUP_DIR"

case "$MODE" in
    full|diff|log) backup_database "$MODE" ;;
    uploads)       backup_uploads ;;
esac

# --- Push offsite ------------------------------------------------------------
# This is the step that makes it a backup rather than a second copy on the same
# disk. The B2 key MUST be append-only so a compromised VPS cannot erase history;
# run `restic forget --prune` from your workstation with a separate key.
log "pushing to offsite repository"
restic backup --tag "$MODE" --host cu-prod "$BACKUP_DIR" \
    --exclude '*.tmp' --quiet

# --- Local retention ---------------------------------------------------------
# Offsite retention is handled by restic policy from the workstation. Locally we
# only keep enough to satisfy a fast restore chain.
find "$BACKUP_DIR" -name 'log_*.trn'        -mtime +3  -delete
find "$BACKUP_DIR" -name 'diff_*.bak'       -mtime +8  -delete
find "$BACKUP_DIR" -name 'full_*.bak'       -mtime +15 -delete
find "$BACKUP_DIR" -name 'uploads_*.tar.gz' -mtime +8  -delete

# --- Success -----------------------------------------------------------------
[ -n "${HC_URL:-}" ] && curl -fsS -m 10 --retry 3 "$HC_URL" >/dev/null 2>&1 || true
log "OK"
