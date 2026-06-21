from django.core.management.base import BaseCommand
import os
import psycopg2


class Command(BaseCommand):
    help = 'Diagnostic: test DB connection and print sanitized connection info'

    def handle(self, *args, **options):
        db = os.environ.get('DATABASE_URL')
        if not db:
            self.stderr.write('ERROR: DATABASE_URL not set')
            return

        # Print a sanitized summary (no password)
        try:
            from urllib.parse import urlparse
            p = urlparse(db)
            user = p.username or ''
            host = p.hostname or ''
            port = p.port or 5432
            name = p.path.lstrip('/') or ''
            self.stdout.write(f'DB host={host} port={port} dbname={name} user={user}')
        except Exception:
            self.stdout.write('WARNING: could not parse DATABASE_URL')

        try:
            sslmode = os.environ.get('PGSSLMODE') or os.environ.get('DATABASE_SSL_REQUIRE')
            conn_kwargs = {'dsn': db, 'connect_timeout': 5}
            if sslmode and str(sslmode).strip().lower() in ('1', 'true', 'yes'):
                conn_kwargs['sslmode'] = 'require'
            conn = psycopg2.connect(**conn_kwargs)
            cur = conn.cursor()
            cur.execute('SELECT version()')
            ver = cur.fetchone()[0]
            cur.close()
            conn.close()
            self.stdout.write('Connection succeeded: ' + ver)
        except Exception as e:
            self.stderr.write('Connection failed: ' + str(e))
