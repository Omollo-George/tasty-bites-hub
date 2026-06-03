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
from django.contrib import admin
from django.urls import path, include
from django.http import JsonResponse, HttpResponse

def health_check(request):
    """Health check endpoint for Render deployment monitoring."""
    return JsonResponse({'status': 'ok', 'service': 'tasty-bites-backend'})


def homepage(request):
    return HttpResponse(
        '<h1>Tasty Bites Backend</h1>'
        '<p>API is available at <a href="/api/health/">/api/health/</a> and <a href="/api/payments/">/api/payments/</a>.</p>',
        content_type='text/html'
    )

urlpatterns = [
    path('', homepage, name='homepage'),
    path('admin/', admin.site.urls),
    path('api/', health_check, name='api_root'),
    path('api/health/', health_check, name='health_check'),
    path('api/health', health_check), # No slash for compatibility
    path('api/payments/', include('payments.urls')),
]
