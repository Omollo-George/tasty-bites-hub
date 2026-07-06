import json
import urllib.request
import sys

url = 'http://127.0.0.1:8000/payments/pos/create-order/'
payload = {
    'order_type': 'table',
    'table_number': '1',
    'items': [{'name': 'Test Item', 'price': 100, 'quantity': 1}],
    'payment_method': 'mpesa',
    'phone': '0712345678'
}
req = urllib.request.Request(url, data=json.dumps(payload).encode('utf-8'), headers={'Content-Type': 'application/json'})
try:
    with urllib.request.urlopen(req, timeout=15) as r:
        print('STATUS', r.status)
        body = r.read().decode('utf-8')
        print('BODY', body)
except Exception as e:
    print('ERROR', repr(e))
    sys.exit(1)
