import os
from urllib.parse import urlparse
import psycopg2

url = urlparse(os.environ['DATABASE_URL'])
conn = psycopg2.connect(
    dbname=url.path[1:],
    user=url.username,
    password=url.password,
    host=url.hostname,
    port=url.port or 5432,
    sslmode='require',
)
cur = conn.cursor()
cur.execute("SELECT app, name FROM django_migrations WHERE app='payments' ORDER BY name")
print('migrations:', cur.fetchall())
cur.execute("SELECT name, applied FROM django_migrations WHERE app='payments' AND name='0011_adminsessionlog_admintoken_session_log'")
print('payments 0011 migration row:', cur.fetchall())
for table in ['payments_adminuser', 'payments_admintoken', 'payments_adminsessionlog']:
    cur.execute(
        "SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name=%s ORDER BY ordinal_position",
        (table,),
    )
    rows = cur.fetchall()
    print('TABLE', table)
    if rows:
        for row in rows:
            print(' ', row)
    else:
        print('  (missing)')
cur.close()
conn.close()
