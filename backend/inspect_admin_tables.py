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
for table in ['payments_admintoken', 'payments_adminsessionlog', 'payments_adminuser']:
    print('TABLE:', table)
    cur.execute("SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name=%s ORDER BY ordinal_position", (table,))
    rows = cur.fetchall()
    if rows:
        for r in rows:
            print('  ', r)
    else:
        print('  (missing)')
    print()
cur.close()
conn.close()
