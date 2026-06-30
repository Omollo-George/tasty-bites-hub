#!/usr/bin/env python
import os
import sys

# Set Django DEBUG mode to allow local development without DATABASE_URL
os.environ.setdefault('DJANGO_DEBUG', 'True')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'tastybites.settings')

import django
django.setup()

from payments.models import AdminUser

try:
    user = AdminUser.objects.get(username='George')
    user.set_password('admin')
    user.save()
    print('✓ Password set to: admin')
    print('')
    print('Try logging in with:')
    print('  Username: George')
    print('  Password: admin')
except Exception as e:
    print(f'Error: {e}')
    sys.exit(1)
