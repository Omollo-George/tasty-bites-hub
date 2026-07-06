#!/usr/bin/env python
"""Reset MPESA test transactions from success to pending."""
import sqlite3

conn = sqlite3.connect('db.sqlite3')
cursor = conn.cursor()

# Count MPESA success transactions before
cursor.execute("SELECT COUNT(*), SUM(amount) FROM payments_transaction WHERE method='mpesa' AND status='success'")
count_before, total_before = cursor.fetchone()
print(f'MPESA success transactions before: {count_before} (Total: {total_before or 0:.2f} KES)')

# Update them all to pending
cursor.execute("UPDATE payments_transaction SET status='pending' WHERE method='mpesa' AND status='success'")
conn.commit()

# Count MPESA success transactions after
cursor.execute("SELECT COUNT(*), SUM(amount) FROM payments_transaction WHERE method='mpesa' AND status='success'")
count_after, total_after = cursor.fetchone()
print(f'MPESA success transactions after: {count_after} (Total: {total_after or 0:.2f} KES)')

# Show MPESA pending total
cursor.execute("SELECT SUM(amount) FROM payments_transaction WHERE method='mpesa' AND status='pending'")
pending_total = cursor.fetchone()[0]
print(f'MPESA pending transactions total: {pending_total or 0:.2f} KES')

conn.close()
print('✓ Reset complete! MPESA revenue will now only show completed transactions.')
