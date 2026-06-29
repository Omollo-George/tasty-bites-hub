import requests
import json
url = 'http://127.0.0.1:8000/api/payments/pos/create-order/'
payload = {
    'items': [{'name': 'Test Item', 'price': 10, 'quantity': 1}],
    'order_type': 'counter'
}
try:
    r = requests.post(url, json=payload, timeout=10)
    print('STATUS', r.status_code)
    try:
        print(r.json())
    except Exception:
        print(r.text)
except Exception as e:
    print('ERROR', e)
