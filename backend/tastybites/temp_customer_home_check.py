import os
import sys

os.environ['DJANGO_DEBUG'] = '1'
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'tastybites.settings')

sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

import django

django.setup()

from django.test import RequestFactory
from payments.views import customer_home

req = RequestFactory().get('/payments/customer/home/')
res = customer_home(req)
print('status:', res.status_code)
print('content:')
print(res.content.decode('utf-8'))
