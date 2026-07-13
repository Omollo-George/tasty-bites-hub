import os
import time
import sys
from urllib.parse import urlparse

from django.core.management import call_command


def _get_env_bool(name: str, default: str = '') -> bool:
    return str(os.environ.get(name, default)).strip().lower() in ('1', 'true', 'yes', 'on')


def _get_int_env(name: str, default: str) -> int:
    try:
        return int(os.environ.get(name, default))
    except Exception:
        return int(default)


def _get_float_env(name: str, default: str) -> float:
    try:
        return float(os.environ.get(name, default))
    except Exception:
        return float(default)


def _is_sqlite_database_url(db_url: str) -> bool:
    if not db_url:
        return False
    try:
        parsed = urlparse(db_url)
    except Exception:
        return False
    return parsed.scheme.lower() in {'sqlite', 'sqlite3'}


def _wait_for_database():
    db_url = os.environ.get('DATABASE_URL', '').strip()
    if not db_url or _is_sqlite_database_url(db_url):
        return

    retries = _get_int_env('DB_STARTUP_RETRIES', '5')
    delay = _get_float_env('DB_STARTUP_DELAY', '3')
    if retries <= 0:
        return

    try:
        import psycopg2
    except Exception:
        psycopg2 = None

    for attempt in range(1, retries + 1):
        if psycopg2 is None:
            break
        try:
            sslmode = os.environ.get('PGSSLMODE') or os.environ.get('DATABASE_SSL_REQUIRE')
            conn_args = {'dsn': db_url, 'connect_timeout': 5}
            if sslmode and str(sslmode).strip().lower() in ('1', 'true', 'yes'):
                conn_args['sslmode'] = 'require'
            conn = psycopg2.connect(**conn_args)
            conn.close()
            return
        except Exception as exc:
            if attempt >= retries:
                print(f"Database startup check failed after {retries} attempts: {exc}")
                sys.exit(1)
            print(f"Database unavailable ({attempt}/{retries}): {exc}")
            time.sleep(delay)


def _should_auto_migrate() -> bool:
    if _get_env_bool('DJANGO_AUTO_MIGRATE'):
        return True

    debug_env = os.environ.get('DJANGO_DEBUG', os.environ.get('DEBUG', 'False')).strip().lower()
    if os.environ.get('DATABASE_URL') and debug_env not in ('1', 'true', 'yes', 'on'):
        return True

    return False


def run_startup():
    _wait_for_database()
    if _should_auto_migrate():
        try:
            print('Applying pending Django migrations on startup...')
            call_command('migrate', '--noinput')
        except Exception:
            import traceback
            print('Warning: automatic migration failed:')
            traceback.print_exc()
