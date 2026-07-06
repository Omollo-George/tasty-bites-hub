#!/usr/bin/env python
import os
import sys
import django

# Add the project root to the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'tastybites'))

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'tastybites.settings')
django.setup()

from payments.models import AdminUser

username = 'testadmin'
password = 'Test@123'

user = AdminUser.objects.filter(username=username).first()
if user:
    user.set_password(password)
    user.save()
    print(f'✓ Reset password for {username}')
else:
    user = AdminUser(username=username)
    user.set_password(password)
    user.save()
    print(f'✓ Created new admin user: {username}')

print(f'\nTest Login Credentials:')
print(f'  Username: {username}')
print(f'  Password: {password}')
