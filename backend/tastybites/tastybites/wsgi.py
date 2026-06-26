"""
WSGI config for tastybites project.

It exposes the WSGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/6.0/howto/deployment/wsgi/
"""

import os

from django.core.wsgi import get_wsgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'tastybites.settings')

# Optional DB readiness check at WSGI startup to avoid immediate runtime errors
# when the database is transiently unavailable. Controlled via env vars:
# DB_STARTUP_RETRIES (default 60), DB_STARTUP_DELAY (seconds).
try:
	DB_STARTUP_RETRIES = int(os.environ.get('DB_STARTUP_RETRIES', '60'))
except Exception:
	DB_STARTUP_RETRIES = 60
try:
	DB_STARTUP_DELAY = float(os.environ.get('DB_STARTUP_DELAY', '3'))
except Exception:
	DB_STARTUP_DELAY = 3.0

if DB_STARTUP_RETRIES > 0 and os.environ.get('DATABASE_URL'):
	import time
	import sys
	import psycopg2

	db = os.environ.get('DATABASE_URL')
	for i in range(DB_STARTUP_RETRIES):
		try:
			# allow optional sslmode via PGSSLMODE or DATABASE_SSL_REQUIRE
			sslmode = os.environ.get('PGSSLMODE') or os.environ.get('DATABASE_SSL_REQUIRE')
			conn_args = {'dsn': db, 'connect_timeout': 5}
			if sslmode and str(sslmode).strip().lower() in ('1', 'true', 'yes'):
				conn_args['sslmode'] = 'require'
			conn = psycopg2.connect(**conn_args)
			conn.close()
			break
		except Exception as e:
			if i + 1 >= DB_STARTUP_RETRIES:
				print(f"WSGI DB check failed after {DB_STARTUP_RETRIES} attempts: {e}")
				sys.exit(1)
			else:
				print(f"WSGI waiting for DB ({i+1}/{DB_STARTUP_RETRIES}): {e}")
				time.sleep(DB_STARTUP_DELAY)

application = get_wsgi_application()

# Automatically apply any pending migrations on startup in production.
AUTO_MIGRATE = os.environ.get('DJANGO_AUTO_MIGRATE', '').strip().lower() in ('1', 'true', 'yes')
# If not explicitly disabled, auto-run migrations in production containers when a
# real DATABASE_URL is present. This helps avoid the common "payments schema"
# failure mode caused by missing runtime migrations.
if not AUTO_MIGRATE:
    dj_debug = os.environ.get('DJANGO_DEBUG', os.environ.get('DEBUG', 'False')).strip().lower()
    if os.environ.get('DATABASE_URL') and dj_debug not in ('1', 'true', 'yes', 'on'):
        AUTO_MIGRATE = True
# By default do NOT auto-run migrations on serverless/Vercel unless env opts in.
	try:
		from django.core.management import call_command
		print('Applying pending Django migrations on startup...')
		call_command('migrate', '--noinput')
	except Exception as exc:
		import traceback
		print('Warning: automatic migration failed:')
		traceback.print_exc()
