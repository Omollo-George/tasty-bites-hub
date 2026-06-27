import os
import sys
import django
import traceback
import json
from django.core.management import call_command

# Initialize at module scope so Vercel can find them
app = None
handler = None

try:
    # Path to the directory containing manage.py
    # Since this file is in 'api/', we go up one level to root, then into 'tastybites'
    project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "tastybites"))
    if project_root not in sys.path:
        sys.path.insert(0, project_root)

    # Set the Django settings module
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'tastybites.settings')
    os.environ.setdefault('DJANGO_DEBUG', 'False')

    # Diagnostic logging for Vercel
    has_db_url = bool(os.environ.get('DATABASE_URL'))
    print(f'[Django Setup] DATABASE_URL configured: {has_db_url}')
    print(f'[Django Setup] DJANGO_DEBUG={os.environ.get("DJANGO_DEBUG")}')

    # Initialize Django
    django.setup()

    # Ensure migrations are applied before handling production requests.
    # This helps avoid missing relations in newly deployed environments.
    try:
        call_command('migrate', '--noinput', verbosity=0, interactive=False)
        print('[Django Setup] Applied migrations successfully')
    except Exception as exc:
        print('[Django Setup] Migrate failed (continuing):', exc)
        traceback.print_exc()

    # Import the WSGI application even if migrations had issues.
    # This prevents the generic backend_initialization_failed fallback
    # from masking real request-time failures.
    from tastybites.wsgi import application

    # Export for Vercel serverless
    app = application
    handler = application

    print('[Django Setup] Backend initialized successfully')

except Exception as e:
    # Graceful fallback for serverless cold-start failures
    error_msg = f"Backend initialization failed: {str(e)}"
    print(f"ERROR: {error_msg}")
    traceback.print_exc()

    # Create a minimal WSGI app that returns error responses
    def error_handler(environ, start_response):
        response_body = json.dumps({
            'error': 'backend_initialization_failed',
            'message': error_msg,
        }).encode('utf-8')
        status = '500 Internal Server Error'
        response_headers = [
            ('Content-Type', 'application/json'),
            ('Content-Length', str(len(response_body))),
        ]
        start_response(status, response_headers)
        return [response_body]

    app = error_handler
    handler = error_handler
