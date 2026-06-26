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
cur.execute("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE 'payments_%' ORDER BY table_name")
print('TABLES:')
for row in cur.fetchall():
    print(row[0])
cur.execute("SELECT app, name FROM django_migrations WHERE app='payments' ORDER BY name")
print('\nMIGRATIONS:')
for row in cur.fetchall():
    print(row[0], row[1])
cur.close()
conn.close()
