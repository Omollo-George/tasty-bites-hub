#!/bin/sh
set -e

: "${PORT:=8000}"

if [ "${RUN_MIGRATIONS:-false}" = "true" ]; then
  echo "Running Django migrations..."
  python manage.py migrate --noinput
fi

echo "Starting Gunicorn on port ${PORT}..."
exec gunicorn tastybites.wsgi:application --bind 0.0.0.0:${PORT} --workers 2 --timeout 120
