import os
import sys
os.environ['DJANGO_DEBUG'] = 'True'
os.environ['DJANGO_SETTINGS_MODULE'] = 'tastybites.settings'

sys.path.insert(0, os.getcwd())

import django

django.setup()
from django.test import Client
from django.conf import settings

print('DEBUG', settings.DEBUG)
print('ALLOWED_HOSTS', settings.ALLOWED_HOSTS[:10])

client = Client(SERVER_NAME='localhost')
admin_token = getattr(settings, 'MPESA_ADMIN_TOKEN', None)
print('MPESA_ADMIN_TOKEN', admin_token)
for path in ['/payments/reports/summary/', '/payments/reports/wastage/', '/payments/reports/miscellaneous/']:
    print('\nREQUEST', path)
    res = client.get(path, {'period_type': 'week', 'admin_token': admin_token}, follow=False)
    print('STATUS', res.status_code)
    print('CONTENT-TYPE', res.get('Content-Type'))
    print('BODY', res.content[:1000])
