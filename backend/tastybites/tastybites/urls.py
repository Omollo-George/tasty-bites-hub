"""
URL configuration for tastybites project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.0/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from pathlib import Path

from django.contrib import admin
from django.urls import path, include, re_path
from django.http import JsonResponse, HttpResponse
from django.conf import settings
from django.conf.urls.static import static


def health_check(request):
    """Health check endpoint for Render deployment monitoring."""
    return JsonResponse({'status': 'ok', 'service': 'tasty-bites-backend'})


def staff_pos_preview(request):
    preview_path = Path(__file__).resolve().parent / 'staff_pos_preview.html'
    try:
        response = HttpResponse(preview_path.read_text(encoding='utf-8'), content_type='text/html')
        response['Cache-Control'] = 'no-cache, no-store, must-revalidate'
        response['Pragma'] = 'no-cache'
        response['Expires'] = '0'
        return response
    except Exception:
        return HttpResponse('Staff POS preview unavailable', content_type='text/plain', status=500)


def homepage(request):
    # Attempt to serve a route-specific pre-rendered HTML file under STATIC_ROOT first
    try:
        # Normalize the requested path and look for a matching file or index.html inside a folder.
        rel_path = request.path.lstrip('/') or ''
        candidate = settings.STATIC_ROOT / rel_path
        # If the path maps to a directory, prefer its index.html
        if candidate.is_dir():
            index_candidate = candidate / 'index.html'
            if index_candidate.exists():
                response = HttpResponse(index_candidate.read_text(encoding='utf-8'), content_type='text/html')
                response['Cache-Control'] = 'no-cache, no-store, must-revalidate'
                response['Pragma'] = 'no-cache'
                response['Expires'] = '0'
                return response
        # If the path maps directly to a file, serve it
        if candidate.exists() and candidate.is_file():
            response = HttpResponse(candidate.read_text(encoding='utf-8'), content_type='text/html')
            response['Cache-Control'] = 'no-cache, no-store, must-revalidate'
            response['Pragma'] = 'no-cache'
            response['Expires'] = '0'
            return response
        # Fallback to the default index.html at STATIC_ROOT
        index_path = settings.STATIC_ROOT / 'index.html'
        if index_path.exists():
            response = HttpResponse(index_path.read_text(encoding='utf-8'), content_type='text/html')
            response['Cache-Control'] = 'no-cache, no-store, must-revalidate'
            response['Pragma'] = 'no-cache'
            response['Expires'] = '0'
            return response
    except Exception:
        # Fall back to a simple backend index page when static index is not available
        pass

    response = HttpResponse(
        '<h1>Tasty Bites Backend</h1>'
        '<p>API is available at <a href="/api/health/">/api/health/</a> and <a href="/api/payments/">/api/payments/</a>.</p>',
        content_type='text/html'
    )
    response['Cache-Control'] = 'no-cache, no-store, must-revalidate'
    response['Pragma'] = 'no-cache'
    response['Expires'] = '0'
    return response

urlpatterns = [
    path('', homepage, name='homepage'),
    path('django-admin/', admin.site.urls),
    path('api/', health_check, name='api_root'),
    path('api/health/', health_check, name='health_check'),
    path('api/health', health_check), # No slash for compatibility
    path('api/payments/', include('payments.urls')),
    path('payments/', include('payments.urls')),  # Frontend expects /payments/ endpoint
    path('admin/login', homepage),
    path('admin', homepage),
    path('admin/<path:path>', homepage),
    path('staff/login', homepage),
    path('staff', homepage),
    path('staff/pos', staff_pos_preview),
    path('staff/pos/', staff_pos_preview),
    path('staff/<path:path>', homepage),
    re_path(r'^(?!(api/|payments/|media/|django-admin/)).*$', homepage),
]

# Serve user-uploaded media files in all environments.
# In production, this is acceptable for a simple deployment and ensures
# uploaded food images are reachable at /media/... after upload.
urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
