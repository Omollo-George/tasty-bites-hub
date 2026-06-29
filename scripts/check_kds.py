import requests
r = requests.get('http://127.0.0.1:8000/api/payments/kds/queue/')
print('STATUS', r.status_code)
try:
    print(r.json())
except Exception:
    print(r.text)
