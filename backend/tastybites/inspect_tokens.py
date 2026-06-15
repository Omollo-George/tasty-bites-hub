import sqlite3, pathlib
p = pathlib.Path('db.sqlite3')
print('DB exists', p.exists())
conn = sqlite3.connect(str(p))
c = conn.cursor()
c.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='payments_stafftoken';")
print('table exists', c.fetchone() is not None)
c.execute('PRAGMA table_info(payments_stafftoken);')
print('schema:')
for row in c.fetchall():
    print(row)
c.execute('SELECT token, expires_at, employee_id, created_at FROM payments_stafftoken ORDER BY created_at DESC LIMIT 20;')
rows = c.fetchall()
print('rows', len(rows))
print('---')
for r in rows:
    print(r)
conn.close()
