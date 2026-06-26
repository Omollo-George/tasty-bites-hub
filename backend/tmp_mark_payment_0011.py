import os
from urllib.parse import urlparse
import psycopg2
from datetime import datetime

url = urlparse(os.environ['DATABASE_URL'])
conn = psycopg2.connect(
    dbname=url.path[1:],
    user=url.username,
    password=url.password,
    host=url.hostname,
    port=url.port or 5432,
    sslmode='require',
)
conn.autocommit = True
cur = conn.cursor()
cur.execute("SELECT COUNT(*) FROM django_migrations WHERE app='payments' AND name='0011_adminsessionlog_admintoken_session_log'")
count = cur.fetchone()[0]
print('existing rows:', count)
if count == 0:
    cur.execute(
        "INSERT INTO django_migrations (app, name, applied) VALUES (%s, %s, %s)",
        ('payments', '0011_adminsessionlog_admintoken_session_log', datetime.utcnow()),
    )
    print('Inserted payments 0011 migration record')
else:
    print('payments 0011 migration record already present')
cur.close()
conn.close()
