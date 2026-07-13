import sqlite3
from pathlib import Path
for p in [Path('db.sqlite3'), Path('tastybites/db.sqlite3'), Path('tastybites/test_db.sqlite3')]:
    print('DB PATH:', p)
    print('EXISTS:', p.exists())
    if not p.exists():
        continue
    print('SIZE:', p.stat().st_size)
    conn = sqlite3.connect(p)
    cur = conn.cursor()
    try:
        cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
        tables = [row[0] for row in cur.fetchall()]
        print('TABLES:', tables)
        for t in tables:
            try:
                cur.execute(f"SELECT COUNT(*) FROM {t}")
                print('  ', t, cur.fetchone()[0])
            except Exception as e:
                print('  ', t, 'ERROR', e)
    except Exception as e:
        print('SCHEMA ERROR', e)
    conn.close()
    print('---')
