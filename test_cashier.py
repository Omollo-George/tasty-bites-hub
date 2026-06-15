import urllib.request, urllib.error
url = 'http://127.0.0.1:8000/api/payments/cashier/pending-bills/'
req = urllib.request.Request(url, headers={'X-STAFF-TOKEN':'2ec9511f7de447fcaa64942d65b33b08'})
try:
    with urllib.request.urlopen(req, timeout=10) as r:
        print('STATUS', r.status)
        print(r.read().decode('utf-8'))
except urllib.error.HTTPError as e:
    print('STATUS', e.code)
    print(e.read().decode('utf-8'))
except Exception as e:
    print('ERROR', type(e).__name__, e)
