#!/bin/bash
set -e

BACKUP_DIR="$HOME/backups"
DATE=$(date +%Y-%m-%d_%H-%M-%S)
BACKUP_FILE="$BACKUP_DIR/vondic_${DATE}.sql.gz"

mkdir -p "$BACKUP_DIR"

echo "[$(date)] Starting backup..."

docker exec postgres pg_dump -U vondic -d vondic --no-owner --no-acl | gzip > "$BACKUP_FILE"

SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
echo "[$(date)] Backup completed: $BACKUP_FILE ($SIZE)"

find "$BACKUP_DIR" -name "vondic_*.sql.gz" -mtime +7 -delete 2>/dev/null
echo "[$(date)] Old backups (>7 days) cleaned up"
