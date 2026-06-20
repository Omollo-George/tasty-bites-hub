#!/bin/sh
set -e

# If PORT is unset or empty (some platforms inject an empty string),
# ensure we set a sane default to avoid "'' is not a valid port number" errors.
if [ -z "${PORT}" ]; then
  PORT=8000
fi

if [ "${RUN_MIGRATIONS:-false}" = "true" ]; then
  # Before running migrations, wait for the database to be ready. If the
  # database does not become ready within the configured retries, fail when
  # RUN_MIGRATIONS=true so CI/deployments don't proceed with partial state.
  if [ -n "${DATABASE_URL:-}" ]; then
    echo "Waiting for database to become ready..."
    python - <<'PY'
import os, time, sys
import psycopg2

db = os.environ.get('DATABASE_URL')
if not db:
    sys.exit(0)
max_retries = int(os.environ.get('DB_WAIT_RETRIES', '30'))
delay = float(os.environ.get('DB_WAIT_DELAY', '2'))
for i in range(max_retries):
    try:
        conn = psycopg2.connect(db, connect_timeout=5)
        conn.close()
        print('Database is available')
        sys.exit(0)
    except Exception as e:
        print(f"Database not ready ({i+1}/{max_retries}): {e}")
        time.sleep(delay)
print('Database did not become ready in time', file=sys.stderr)
# If migrations are required, signal failure so the deployment can be inspected.
if os.environ.get('RUN_MIGRATIONS','false').lower() == 'true':
    sys.exit(1)
sys.exit(0)
PY
  fi

  echo "Running Django migrations..."
  python manage.py migrate --noinput
fi

echo "Starting Gunicorn on port ${PORT}..."
exec gunicorn tastybites.wsgi:application --bind 0.0.0.0:${PORT} --workers 2 --timeout 120
