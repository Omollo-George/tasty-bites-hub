import os
import sys

# Path to the directory containing manage.py
# Since this file is in 'api/', we go up one level to root, then into 'tastybites'
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "tastybites"))
if project_root not in sys.path:
    sys.path.append(project_root)

# Set the Django settings module
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'tastybites.settings')
os.environ.setdefault('DJANGO_DEBUG', 'False')

try:
    from tastybites.wsgi import application
    app = application
except Exception as e:
    print(f"Error loading WSGI application: {e}")
    raise