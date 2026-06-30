#!/usr/bin/env python
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'tastybites.settings')
django.setup()

from payments.models import AdminUser

user = AdminUser.objects.filter(username='George').first()
if user:
    print(f'User: {user.username}')
    print(f'Password Hash: {user.password_hash[:50]}...')
    print(f'Created: {user.created_at}')
    print(f'Failed Attempts: {user.failed_login_attempts}')
    print(f'Locked Until: {user.lockout_until}')
    
    # Test password verification
    test_password = 'George@123'
    is_valid = user.check_password(test_password)
    print(f'\nPassword Check for "{test_password}": {is_valid}')
    
    # Try different passwords
    print('\n--- Testing other passwords ---')
    for pwd in ['George', 'george', 'Admin123!', 'test']:
        result = user.check_password(pwd)
        print(f'  {pwd}: {result}')
else:
    print('User George not found')
