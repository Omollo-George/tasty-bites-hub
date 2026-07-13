import os, json, urllib.request
os.environ['DJANGO_SETTINGS_MODULE'] = 'tastybites.settings'
os.environ['DATABASE_URL'] = 'sqlite:///db.sqlite3'
os.environ['FORCE_CONSOLE_EMAIL'] = '1'
import django
django.setup()
from payments.models import Employee
emp = Employee.objects.order_by('id').first()
req = urllib.request.Request(
    f'http://127.0.0.1:8000/payments/admin/employees/{emp.id}/email/',
    data=json.dumps({'message': 'hello', 'subject': 'Test'}).encode(),
    headers={'Content-Type': 'application/json', 'Authorization': 'Bearer dev-admin-token'},
    method='POST',
)
try:
    with urllib.request.urlopen(req, timeout=15) as f:
        print(f.status)
        print(f.read().decode())
except Exception as e:
    print(type(e).__name__, e)
    if hasattr(e, 'read'):
        print(e.read().decode())
