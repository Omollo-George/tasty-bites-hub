"""
WSGI config for tastybites project.

It exposes the WSGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/6.0/howto/deployment/wsgi/
"""

import os

from django.core.wsgi import get_wsgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'tastybites.settings')

<<<<<<< HEAD
# Optional DB readiness check at WSGI startup to avoid immediate runtime errors
# when the database is transiently unavailable. Controlled via env vars:
# DB_STARTUP_RETRIES (default 0 = no wait), DB_STARTUP_DELAY (seconds),
# RUN_MIGRATIONS (if true, fail fast when DB unreachable).
try:
	DB_STARTUP_RETRIES = int(os.environ.get('DB_STARTUP_RETRIES', '0'))
except Exception:
	DB_STARTUP_RETRIES = 0
try:
	DB_STARTUP_DELAY = float(os.environ.get('DB_STARTUP_DELAY', '2'))
except Exception:
	DB_STARTUP_DELAY = 2.0

if DB_STARTUP_RETRIES > 0 and os.environ.get('DATABASE_URL'):
	import time
	import sys
	import psycopg2

	db = os.environ.get('DATABASE_URL')
	for i in range(DB_STARTUP_RETRIES):
		try:
			conn = psycopg2.connect(db, connect_timeout=5)
			conn.close()
			break
		except Exception as e:
			# Last attempt: if RUN_MIGRATIONS is true, we will fail after retries
			if i + 1 >= DB_STARTUP_RETRIES:
				print(f"WSGI DB check failed after {DB_STARTUP_RETRIES} attempts: {e}")
				if os.environ.get('RUN_MIGRATIONS','false').lower() == 'true':
					sys.exit(1)
				else:
					print('Continuing startup without DB (RUN_MIGRATIONS is false)')
					break
			else:
				print(f"WSGI waiting for DB ({i+1}/{DB_STARTUP_RETRIES}): {e}")
				time.sleep(DB_STARTUP_DELAY)

=======
>>>>>>> 17ad926bdef4d18c8374f33747670159bee73ce0
application = get_wsgi_application()
