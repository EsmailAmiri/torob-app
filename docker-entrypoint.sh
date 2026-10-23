#!/bin/sh
set -eu

db_path="${DATABASE_PATH:-/app/runtime/torob.sqlite}"
mkdir -p "$(dirname "$db_path")"
chown node:node "$(dirname "$db_path")"
if [ -s "$db_path" ]; then
  python3 - "$db_path" <<'PY'
import os, sqlite3, sys
path = sys.argv[1]
db = sqlite3.connect(path)
try:
    products = db.execute('SELECT COUNT(*) FROM products').fetchone()[0]
    shops = db.execute('SELECT COUNT(*) FROM shops').fetchone()[0]
    if products == 225903 and shops == 6476:
        sys.exit(0)
    sessions = db.execute('SELECT COUNT(*) FROM sessions').fetchone()[0]
    inquiries = db.execute('SELECT COUNT(*) FROM inquiries').fetchone()[0]
    if sessions or inquiries:
        raise RuntimeError('Incomplete catalogue contains user data; manual recovery required')
finally:
    db.close()
for suffix in ('', '-wal', '-shm'):
    try:
        os.remove(path + suffix)
    except FileNotFoundError:
        pass
print('Removed incomplete first-run catalogue; rebuilding', flush=True)
PY
fi
if [ ! -s "$db_path" ]; then
  seed_path="${db_path}.initializing"
  rm -f "$seed_path" "${seed_path}-wal" "${seed_path}-shm"
  DATABASE_PATH="$seed_path" gosu node python3 /app/scripts/seed_sqlite.py
  if [ -s "${seed_path}-wal" ]; then
    echo "SQLite WAL was not checkpointed; refusing incomplete database" >&2
    exit 1
  fi
  mv "$seed_path" "$db_path"
  rm -f "${seed_path}-wal" "${seed_path}-shm"
fi

exec gosu node node --import tsx /app/server/node.ts
