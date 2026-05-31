from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/payments/', include('tastybites.payments.urls')),
    # Add other app URLs here if you have any
]