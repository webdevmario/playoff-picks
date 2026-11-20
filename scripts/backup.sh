#!/bin/bash
# Consistent snapshot of the live database (safe while the server runs).
set -euo pipefail
DATA_DIR="${DATA_DIR:-$HOME/Library/Application Support/playoff-picks}"
BACKUP_DIR="${BACKUP_DIR:-$HOME/Backups/playoff-picks}"
mkdir -p "$BACKUP_DIR"
out="$BACKUP_DIR/playoff-picks-$(date +%Y%m%d-%H%M%S).db"
sqlite3 "$DATA_DIR/playoff-picks.db" ".backup '$out'"
# Keep the 30 most recent snapshots.
ls -1t "$BACKUP_DIR"/playoff-picks-*.db 2>/dev/null | tail -n +31 | while read -r f; do rm -f "$f"; done
echo "Backed up to $out"
