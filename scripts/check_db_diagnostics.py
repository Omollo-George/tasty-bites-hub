#!/usr/bin/env python3
"""Standalone DB diagnostic script — run directly (does not require Django).

Usage:
  export DATABASE_URL='postgresql://user:pass@host:5432/dbname?sslmode=require'
  export PGSSLMODE=require
  python scripts/check_db_diagnostics.py
"""

import os
import sys

try:
    import psycopg2
except Exception as e:
    print('ERROR: psycopg2 not installed:', e)
    sys.exit(2)


def main():
    db = os.environ.get('DATABASE_URL')
    if not db:
        print('ERROR: DATABASE_URL not set')
        print("Set DATABASE_URL or run with: DATABASE_URL=postgresql://user:pass@host:5432/dbname python scripts/check_db_diagnostics.py")
        return 2

    # Print sanitized connection summary
    try:
        from urllib.parse import urlparse
        p = urlparse(db)
        user = p.username or ''
        host = p.hostname or ''
        port = p.port or 5432
        name = p.path.lstrip('/') or ''
        print(f'DB host={host} port={port} dbname={name} user={user}')
    except Exception:
        print('WARNING: could not parse DATABASE_URL')

    sslmode = os.environ.get('PGSSLMODE') or os.environ.get('DATABASE_SSL_REQUIRE')
    if sslmode and str(sslmode).strip().lower() in ('1', 'true', 'yes'):
        sslmode = 'require'
    else:
        sslmode = None

    try:
        conn_kwargs = {'dsn': db, 'connect_timeout': 5}
        if sslmode:
            conn_kwargs['sslmode'] = sslmode
        conn = psycopg2.connect(**conn_kwargs)
        cur = conn.cursor()
        cur.execute('SELECT version()')
        ver = cur.fetchone()[0]
        cur.close()
        conn.close()
        print('Connection succeeded: ' + ver)
        return 0
    except Exception as e:
        print('Connection failed: ' + str(e))
        return 3


if __name__ == '__main__':
    sys.exit(main())
