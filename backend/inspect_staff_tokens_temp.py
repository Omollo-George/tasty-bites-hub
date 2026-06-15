import sqlite3
from pathlib import Path

p = Path(__file__).resolve().parent / 'tastybites' / 'db.sqlite3'
print('DB path:', p)
print('Exists:', p.exists())
if not p.exists():
    raise SystemExit(1)
conn = sqlite3.connect(str(p))
c = conn.cursor()
c.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='payments_stafftoken';")
print('payments_stafftoken table exists:', c.fetchone() is not None)
c.execute('PRAGMA table_info(payments_stafftoken);')
print('schema:')
for row in c.fetchall():
    print(row)

c.execute('SELECT token, expires_at, employee_id, created_at FROM payments_stafftoken ORDER BY created_at DESC LIMIT 50;')
rows = c.fetchall()
print(f'rows: {len(rows)}')
for r in rows:
    print(r)
conn.close()