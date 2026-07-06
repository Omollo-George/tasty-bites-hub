#!/usr/bin/env python
import os
import sys
import django
import json

# Add the project root to the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'tastybites'))

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'tastybites.settings')
django.setup()

from django.test import RequestFactory
from payments.views import automation_insights
from payments.models import AdminUser

# Create a mock request with admin token
factory = RequestFactory()

# Get the admin user
admin_user = AdminUser.objects.first()
if not admin_user:
    print("No admin user found!")
    sys.exit(1)

# Create an admin token
from payments.models import AdminToken
token, _ = AdminToken.objects.get_or_create(user=admin_user)

# Create a request with the token
request = factory.get('/payments/automation/insights/')
request.META['HTTP_AUTHORIZATION'] = f'Bearer {token.token}'

# Call the view
print("Testing automation_insights endpoint...")
try:
    response = automation_insights(request)
    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        data = json.loads(response.content)
        print("Response keys:", list(data.keys()))
        print("✓ Endpoint is working!")
    else:
        print(f"Error: {response.content.decode()}")
except Exception as e:
    print(f"Exception: {type(e).__name__}: {e}")
    import traceback
    traceback.print_exc()
