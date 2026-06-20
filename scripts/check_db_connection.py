#!/usr/bin/env python3
"""Check PostgreSQL connection using DATABASE_URL from the environment."""

import os
import sys

try:
    import psycopg2
except ImportError:
    print("ERROR: psycopg2 is not installed. Install dependencies first.")
    sys.exit(1)


def get_db_url():
    return os.environ.get('DATABASE_URL')


def main():
    db_url = get_db_url()
    if not db_url:
        print('ERROR: DATABASE_URL environment variable is not set.')
        print('Set DATABASE_URL or run with DATABASE_URL=postgresql://user:pass@host:5432/dbname python scripts/check_db_connection.py')
        sys.exit(1)

    print('Testing database connection...')
    print(f'  DATABASE_URL={db_url}')

    try:
        conn = psycopg2.connect(db_url, connect_timeout=10)
        cur = conn.cursor()
        cur.execute('SELECT version()')
        version = cur.fetchone()[0]
        cur.execute('SELECT 1')
        one = cur.fetchone()[0]
        print('Database connection succeeded')
        print(f'  Postgres version: {version}')
        print(f'  Sample query result: {one}')
        cur.close()
        conn.close()
        sys.exit(0)
    except Exception as exc:
        print('Database connection failed:')
        print(str(exc))
        sys.exit(2)


if __name__ == '__main__':
    main()
