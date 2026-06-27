import os
import django

os.environ['DJANGO_DEBUG'] = 'True'
os.environ['DJANGO_SETTINGS_MODULE'] = 'tastybites.settings'

print('PWD', os.getcwd())
print('DJANGO_DEBUG', os.environ.get('DJANGO_DEBUG'))
print('DJANGO_SETTINGS_MODULE', os.environ.get('DJANGO_SETTINGS_MODULE'))

django.setup()

import payments.views as views
print('views loaded', views.__file__)
print('period', views._get_period_dates('week', '2025-01-01'))
try:
    print('custom', views._get_period_dates('custom', '2025-01-01'))
except Exception as e:
    print('custom error', type(e).__name__, e)
