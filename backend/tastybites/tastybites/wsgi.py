"""
WSGI config for tastybites project.

It exposes the WSGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/6.0/howto/deployment/wsgi/
"""

import os

from django.core.wsgi import get_wsgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'tastybites.settings')

# DB readiness + optional auto-migrate at WSGI startup.
# Default to a conservative retry count when a DATABASE_URL is present in
# production so deployments that start before the DB will wait a bit instead
# of immediately failing with a 503 schema_not_ready.
try:
	# If user explicitly sets DB_STARTUP_RETRIES, respect it; otherwise default
	# to 5 retries for real DATABASE_URL deployments (safe and conservative).
	raw_retries = os.environ.get('DB_STARTUP_RETRIES')
	if raw_retries is None and os.environ.get('DATABASE_URL'):
		DB_STARTUP_RETRIES = 5
	else:
		DB_STARTUP_RETRIES = int(raw_retries or 0)
except Exception:
	DB_STARTUP_RETRIES = 0
try:
	DB_STARTUP_DELAY = float(os.environ.get('DB_STARTUP_DELAY', '3'))
except Exception:
	DB_STARTUP_DELAY = 3.0

if DB_STARTUP_RETRIES > 0 and os.environ.get('DATABASE_URL'):
	import time
	import sys
	try:
		import psycopg2
	except Exception:
		psycopg2 = None

	db = os.environ.get('DATABASE_URL')
	for i in range(DB_STARTUP_RETRIES):
		try:
			if psycopg2:
				# allow optional sslmode via PGSSLMODE or DATABASE_SSL_REQUIRE
				sslmode = os.environ.get('PGSSLMODE') or os.environ.get('DATABASE_SSL_REQUIRE')
				conn_args = {'dsn': db, 'connect_timeout': 5}
				if sslmode and str(sslmode).strip().lower() in ('1', 'true', 'yes'):
					conn_args['sslmode'] = 'require'
				conn = psycopg2.connect(**conn_args)
				conn.close()
			# If psycopg2 not installed, skip low-level check and rely on migrate call
			break
		except Exception as e:
			if i + 1 >= DB_STARTUP_RETRIES:
				print(f"WSGI DB check failed after {DB_STARTUP_RETRIES} attempts: {e}")
				sys.exit(1)
			else:
				print(f"WSGI waiting for DB ({i+1}/{DB_STARTUP_RETRIES}): {e}")
				time.sleep(DB_STARTUP_DELAY)

# Decide whether to auto-apply migrations on startup.
AUTO_MIGRATE = os.environ.get('DJANGO_AUTO_MIGRATE', '').strip().lower() in ('1', 'true', 'yes')
# If not explicitly enabled, auto-run migrations in production containers when a
# real DATABASE_URL is present and DEBUG is not enabled.
if not AUTO_MIGRATE:
	dj_debug = os.environ.get('DJANGO_DEBUG', os.environ.get('DEBUG', 'False')).strip().lower()
	if os.environ.get('DATABASE_URL') and dj_debug not in ('1', 'true', 'yes', 'on'):
		AUTO_MIGRATE = True

if AUTO_MIGRATE:
	try:
		from django.core.management import call_command
		print('Applying pending Django migrations on startup...')
		call_command('migrate', '--noinput')
	except Exception as exc:
		import traceback
		print('Warning: automatic migration failed:')
		traceback.print_exc()

application = get_wsgi_application()
