# Production deployment configuration for Render

## Frontend (Static Site)
# Set by render.yaml from backend service URL
# VITE_API_URL will be injected during build

## Backend (Web Service)
# Django configuration
DJANGO_SECRET_KEY=your-secret-key-here
DJANGO_DEBUG=False
ALLOWED_HOSTS=*.onrender.com,localhost,127.0.0.1

# CORS Configuration - set to comma-separated list of allowed origins
CORS_ALLOW_ALL_ORIGINS=False
CORS_ALLOWED_ORIGINS=https://your-frontend-url.onrender.com

# M-Pesa Configuration (update with production values)
MPESA_ENVIRONMENT=sandbox
MPESA_CALLBACK_URL=https://your-backend-url.onrender.com/api/payments/callback/

# Email Configuration
EMAIL_HOST_USER=your-email@gmail.com
EMAIL_HOST_PASSWORD=your-app-password

# Currency Rate
MPESA_TO_KES_RATE=1

# Admin token for admin endpoints
MPESA_ADMIN_TOKEN=your-secure-admin-token
