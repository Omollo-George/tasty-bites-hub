#!/bin/sh
set -e

# If PORT is unset, empty, or only whitespace, set a sane default to avoid
# "'' is not a valid port number" errors.
if [ -z "$(printf '%s' "${PORT}" | tr -d '[:space:]')" ]; then
  PORT=8000
fi
export PORT

echo "Runtime PORT value:'${PORT}'"
if [ -z "$(printf '%s' "${PORT}" | tr -d '[:space:]')" ]; then
  echo "PORT was empty or whitespace, defaulting to 8000"
fi

DB_WAIT_RETRIES=${DB_WAIT_RETRIES:-60}
DB_WAIT_DELAY=${DB_WAIT_DELAY:-3}

wait_for_db() {
  if [ -n "${DATABASE_URL:-}" ] && [ "${DB_WAIT_RETRIES}" -gt 0 ]; then
    echo "Waiting for database to become ready..."
    python - <<'PY'
import os, time, sys
import psycopg2

db = os.environ.get('DATABASE_URL')
if not db:
    sys.exit(0)
max_retries = int(os.environ.get('DB_WAIT_RETRIES', '30'))
delay = float(os.environ.get('DB_WAIT_DELAY', '2'))
sslmode = os.environ.get('PGSSLMODE') or os.environ.get('DATABASE_SSL_REQUIRE')
if sslmode and sslmode.strip().lower() in ('1', 'true', 'yes'):
    sslmode = 'require'
for i in range(max_retries):
    try:
        connect_kwargs = {'dsn': db, 'connect_timeout': 5}
        if sslmode:
            connect_kwargs['sslmode'] = sslmode.strip()
        conn = psycopg2.connect(**connect_kwargs)
        conn.close()
        print('Database is available')
        sys.exit(0)
    except Exception as e:
        print(f"Database not ready ({i+1}/{max_retries}): {e}")
        time.sleep(delay)
print('Database did not become ready in time', file=sys.stderr)
sys.exit(1)
PY
  fi
}

wait_for_db

DJANGO_DEBUG=${DJANGO_DEBUG:-false}
DJANGO_DEBUG_LOWER=$(printf '%s' "$DJANGO_DEBUG" | tr '[:upper:]' '[:lower:]')
if [ -z "${RUN_MIGRATIONS:-}" ] && [ "$DJANGO_DEBUG_LOWER" = "false" ] && [ -n "${DATABASE_URL:-}" ]; then
  RUN_MIGRATIONS=true
fi

if [ "${RUN_MIGRATIONS}" = "true" ]; then
  echo "Running Django migrations..."
  python manage.py migrate --noinput
fi

echo "Starting Gunicorn on port ${PORT:-8000}..."
exec gunicorn tastybites.wsgi:application --bind 0.0.0.0:${PORT:-8000} --workers 2 --timeout 120
