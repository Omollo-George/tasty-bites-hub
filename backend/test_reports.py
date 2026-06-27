import os, sys
os.environ['DJANGO_DEBUG'] = 'True'
os.environ['DJANGO_SETTINGS_MODULE'] = 'tastybites.settings'
sys.path.insert(0, os.getcwd())
import django
django.setup()
from django.test import Client
from django.conf import settings
print('DEBUG', settings.DEBUG)
client = Client()
for url in ['/payments/reports/summary/?period_type=week', '/payments/reports/wastage/?period_type=week', '/payments/reports/miscellaneous/?period_type=week']:
    print('REQUEST', url)
    response = client.get(url, {'admin_token': settings.MPESA_ADMIN_TOKEN})
    print('STATUS', response.status_code)
    print('CONTENT-TYPE', response['Content-Type'])
    print('BODY', response.content[:1000])
    print('---')
