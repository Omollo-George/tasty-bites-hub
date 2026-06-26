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
conn.autocommit = True
cur = conn.cursor()

print('Checking payments_adminsessionlog...')
cur.execute("SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='payments_adminsessionlog')")
if cur.fetchone()[0]:
    print('payments_adminsessionlog already exists')
else:
    print('Creating payments_adminsessionlog')
    cur.execute(
        """
        CREATE TABLE payments_adminsessionlog (
            id BIGSERIAL PRIMARY KEY,
            user_id bigint NOT NULL,
            login_time timestamptz NOT NULL DEFAULT now(),
            logout_time timestamptz NULL
        )
        """
    )
    cur.execute(
        "ALTER TABLE payments_adminsessionlog ADD CONSTRAINT payments_adminsessionlog_user_id_fkey FOREIGN KEY (user_id) REFERENCES payments_adminuser(id) ON DELETE CASCADE"
    )

print('Checking payments_admintoken.session_log_id...')
cur.execute("SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='payments_admintoken' AND column_name='session_log_id')")
if cur.fetchone()[0]:
    print('session_log_id column already exists')
else:
    print('Adding session_log_id column to payments_admintoken')
    cur.execute("ALTER TABLE payments_admintoken ADD COLUMN session_log_id bigint UNIQUE NULL")
    cur.execute(
        "ALTER TABLE payments_admintoken ADD CONSTRAINT payments_admintoken_session_log_id_fkey FOREIGN KEY (session_log_id) REFERENCES payments_adminsessionlog(id) ON DELETE SET NULL"
    )

print('Verifying schema...')
cur.execute("SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name='payments_adminsessionlog' ORDER BY ordinal_position")
for row in cur.fetchall():
    print('payments_adminsessionlog:', row)
cur.execute("SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name='payments_admintoken' ORDER BY ordinal_position")
for row in cur.fetchall():
    print('payments_admintoken:', row)

cur.close()
conn.close()
