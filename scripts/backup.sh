#!/usr/bin/env bash
# Back up the ePaper data directory.
#
#   scripts/backup.sh /path/to/backups
#
# Two things have to be captured together: the SQLite database and the
# rendered pages. A database naming objects that are not in the backup is
# worse than no backup, so the database is snapshotted first with the online
# backup API, which is consistent against a server that is still writing.
# Copying the file directly while WAL is active can capture a torn database.
set -euo pipefail

DEST="${1:-./backups}"
DATA_DIR="${DATA_DIR:-data}"
DB="${DATABASE_PATH:-$DATA_DIR/epaper.db}"
STAMP="$(date +%Y%m%d-%H%M%S)"
OUT="$DEST/$STAMP"

mkdir -p "$OUT"

echo "backing up database..."
# .backup is safe on a live database; cp is not.
sqlite3 "$DB" ".backup '$OUT/epaper.db'"

echo "backing up stored pages..."
# Hard links where possible, so successive backups of an append-only archive
# cost only what actually changed.
if [ -d "$DATA_DIR/storage" ]; then
  LATEST="$(ls -1d "$DEST"/*/ 2>/dev/null | grep -v "$STAMP" | tail -1 || true)"
  if [ -n "$LATEST" ] && [ -d "${LATEST}storage" ]; then
    cp -al "${LATEST}storage" "$OUT/storage" 2>/dev/null || mkdir -p "$OUT/storage"
    rsync -a --delete "$DATA_DIR/storage/" "$OUT/storage/"
  else
    rsync -a "$DATA_DIR/storage/" "$OUT/storage/"
  fi
fi

echo "verifying..."
# A backup nobody has read is a guess. This one is opened and queried.
PAGES="$(sqlite3 "$OUT/epaper.db" "SELECT COUNT(*) FROM pages;")"
ISSUES="$(sqlite3 "$OUT/epaper.db" "SELECT COUNT(*) FROM issues WHERE status='ready';")"
echo "  $ISSUES editions, $PAGES pages"
[ "$PAGES" -gt 0 ] || { echo "  backup looks empty, failing"; exit 1; }

du -sh "$OUT"
echo "done: $OUT"
