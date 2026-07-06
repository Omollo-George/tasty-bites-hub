#!/usr/bin/env python
import os
import django

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
