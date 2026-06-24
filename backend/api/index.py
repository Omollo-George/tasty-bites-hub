import os
import sys
import django

# Path to the directory containing manage.py
# Since this file is in 'api/', we go up one level to root, then into 'tastybites'
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "tastybites"))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

# Set the Django settings module
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'tastybites.settings')
os.environ.setdefault('DJANGO_DEBUG', 'False')

# Initialize Django
django.setup()

# Import the WSGI application
from tastybites.wsgi import application

# Export for Vercel serverless
app = application
handler = application

__all__ = ["app", "handler"]