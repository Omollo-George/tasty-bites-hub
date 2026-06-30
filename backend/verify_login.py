#!/usr/bin/env python
import os
os.environ.setdefault('DJANGO_DEBUG', 'True')
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'tastybites.settings')
django.setup()

from payments.models import AdminUser
from django.utils import timezone

# Test the login logic directly
username = 'George'
password = 'George@123!'

print(f'Testing login endpoint logic for: {username}')
print()

# Step 1: Find user
user = AdminUser.objects.filter(username=username).first()
print(f'1. User found: {user is not None}')
if not user:
    print('   ERROR: User not found in database!')
    exit(1)

# Step 2: Check for lockout
if user.lockout_until and user.lockout_until > timezone.now():
    print('2. Account is LOCKED OUT')
    exit(1)
print(f'2. Account lockout: None')
print(f'   Failed attempts: {user.failed_login_attempts}')

# Step 3: Check password
is_valid = user.check_password(password)
print(f'3. Password check for "{password}": {is_valid}')
print(f'   Password hash: {user.password_hash[:40]}...')

if not is_valid:
    print()
    print('❌ PASSWORD MISMATCH!')
    print()
    print('Testing other passwords:')
    for test_pwd in ['George@123', 'George123!', 'Admin123!', 'george@123!']:
        result = user.check_password(test_pwd)
        print(f'   {test_pwd}: {result}')
else:
    print()
    print('✓ LOGIN SHOULD SUCCEED')
    print()
    print('If frontend still shows invalid credentials:')
    print('  1. Make sure Django server is running on port 8000')
    print('  2. Check browser console for network errors')
    print('  3. Try clearing browser cache (Ctrl+Shift+Delete)')
    print('  4. Check if backend is properly configured')
