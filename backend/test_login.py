#!/usr/bin/env python
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'tastybites.settings')
django.setup()

from payments.models import AdminUser

# Simulate the exact login request
username = 'George'
password = 'George@123'

print(f"Testing login with:")
print(f"  Username: {username}")
print(f"  Password: {password}")
print()

# Step 1: Find user
user = AdminUser.objects.filter(username=username).first()
print(f"Step 1 - Find user: {user is not None}")
if not user:
    print("ERROR: User not found!")
    exit(1)

print(f"  Username in DB: {user.username}")
print()

# Step 2: Check password
is_valid = user.check_password(password)
print(f"Step 2 - Check password: {is_valid}")
print(f"  Password hash: {user.password_hash[:40]}...")
print()

# Step 3: Check if locked out
print(f"Step 3 - Check lockout:")
print(f"  Failed attempts: {user.failed_login_attempts}")
print(f"  Locked until: {user.lockout_until}")
print()

if not user or not is_valid:
    print("❌ Login would FAIL")
    print()
    print("Testing other passwords:")
    for pwd in ['Admin@123', 'admin123', 'George', 'george@123', 'Password123']:
        result = user.check_password(pwd)
        print(f"  {pwd}: {result}")
else:
    print("✓ Login would SUCCEED")
