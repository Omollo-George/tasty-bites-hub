import sqlite3
from pathlib import Path
p = Path('db.sqlite3')
print('db path', p)
if not p.exists():
    print('db missing')
    raise SystemExit(1)
conn = sqlite3.connect(p)
cur = conn.cursor()
cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
tables = [row[0] for row in cur.fetchall()]
print('tables:', tables)
for t in tables:
    try:
        cur.execute(f"SELECT COUNT(*) FROM {t}")
        print(t, 'count', cur.fetchone()[0])
    except Exception as e:
        print('table', t, 'error', e)
conn.close()
