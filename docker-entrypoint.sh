#!/bin/sh
set -e

# If PORT is unset or empty (some platforms inject an empty string),
# ensure we set a sane default to avoid "'' is not a valid port number" errors.
if [ -z "${PORT}" ]; then
  PORT=8000
fi

if [ "${RUN_MIGRATIONS:-false}" = "true" ]; then
  echo "Running Django migrations..."
  python manage.py migrate --noinput
fi

echo "Starting Gunicorn on port ${PORT}..."
exec gunicorn tastybites.wsgi:application --bind 0.0.0.0:${PORT} --workers 2 --timeout 120
