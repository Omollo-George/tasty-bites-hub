import sqlite3
import os
db_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'backend', 'tastybites', 'db.sqlite3')
if not os.path.exists(db_path):
    print('NO_DB', db_path)
    raise SystemExit(1)
conn = sqlite3.connect(db_path)
cur = conn.cursor()
for row in cur.execute("SELECT name, sql FROM sqlite_master WHERE type='table' ORDER BY name"):
    print(row[0])
conn.close()
