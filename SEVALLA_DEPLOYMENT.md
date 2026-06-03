# Sevalla Deployment Guide

This guide covers deploying Tasty Bites Hub to Sevalla platform.

## Quick Overview

The project uses a **monolithic architecture**:
- **Frontend**: React + TypeScript + Vite (builds to `dist/`)
- **Backend**: Django + Django REST Framework (Python 3.11)
- **Static Files**: Served via WhiteNoise middleware
- **Database**: PostgreSQL (provisioned on Sevalla)

## Prerequisites

1. **Sevalla Account**: [Create an account](https://sevalla.io)
2. **PostgreSQL Database**: Provision one on Sevalla or use an external provider
3. **Environment Variables**: Prepare all required secrets

## Deployment Steps

### 1. Create Backend Service on Sevalla

1. Go to Sevalla Dashboard → Create New Service
2. Select **Python** or **Docker**
3. **Repository**: Connect your GitHub repo
4. **Build Command**:
   ```bash
   cd tastybites && pip install -r requirements.txt && python manage.py migrate && python manage.py collectstatic --no-input
   ```
   _Or use the Dockerfile multi-stage build:_
   ```bash
   # If using Docker, the Dockerfile handles all steps
   ```

5. **Start Command**:
   ```bash
   gunicorn tastybites.wsgi:application --bind 0.0.0.0:$PORT --workers 2 --timeout 30
   ```

6. **Environment Variables** (set in Sevalla Dashboard):
   ```
   DEBUG=False
   ALLOWED_HOSTS=yourapp.sevalla.app,yourdomain.com
   SECRET_KEY=<generate with: python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())">
   DATABASE_URL=postgresql://user:pass@host:5432/dbname
   MPESA_CONSUMER_KEY=<your M-Pesa key>
   MPESA_CONSUMER_SECRET=<your M-Pesa secret>
   MPESA_SHORTCODE=<your M-Pesa shortcode>
   MPESA_PASSKEY=<your M-Pesa passkey>
   MPESA_ENVIRONMENT=production
   MPESA_CALLBACK_URL=https://yourapp.sevalla.app/api/payments/callback/
   MPESA_ADMIN_TOKEN=<secure random token>
   MPESA_EXPRESS_SHORTCODE=<your shortcode>
   CORS_ALLOWED_ORIGINS=https://yourapp.sevalla.app
   SESSION_COOKIE_SECURE=True
   SESSION_COOKIE_HTTPONLY=True
   CSRF_COOKIE_SECURE=True
   ```

### 2. Create Frontend Service (Optional - If Separate)

If deploying frontend separately:

1. Create **Static Site** service
2. **Build Command**:
   ```bash
   npm install && npm run build
   ```
3. **Publish Directory**: `dist`
4. **Environment Variables**:
   ```
   VITE_API_URL=https://yourapp.sevalla.app/api
   VITE_CURRENCY_CODE=KES
   ```

### 3. Database Setup

1. **Create PostgreSQL Database** on Sevalla:
   - Go to Sevalla Dashboard → Databases
   - Create PostgreSQL instance
   - Note the connection string: `postgresql://user:pass@host:5432/dbname`

2. **Set DATABASE_URL** in backend environment variables

3. **Run migrations** (via build command or SSH):
   ```bash
   python manage.py migrate
   ```

### 4. Verify Deployment

After deployment completes:

```bash
# Test backend API
curl https://yourapp.sevalla.app/api/payments/config/

# Test admin login
curl -X POST https://yourapp.sevalla.app/api/payments/admin/signin/ \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"password"}'
```

## Dockerfile Build Process

The included `Dockerfile` uses a **multi-stage build**:

### Stage 1: Frontend Build
```dockerfile
FROM node:20-alpine AS frontend-builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build
```

### Stage 2: Backend with Static Files
```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
COPY --from=frontend-builder /app/dist ./tastybites/staticfiles/dist
RUN python manage.py collectstatic --no-input
CMD ["gunicorn", "tastybites.wsgi:application", "--bind", "0.0.0.0:8000"]
```

## Static Files Configuration

**Django Settings** (`settings.py`):
```python
STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'
STATICFILES_DIRS = [BASE_DIR / 'dist']  # Vite output
```

**WhiteNoise** handles compression and caching for production.

## Environment Variables Reference

| Variable | Required | Example | Notes |
|----------|----------|---------|-------|
| `DEBUG` | Yes | `False` | Must be False in production |
| `SECRET_KEY` | Yes | `django-insecure-...` | Generate with: `python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"` |
| `DATABASE_URL` | Yes | `postgresql://user:pass@host/db` | From Sevalla PostgreSQL |
| `ALLOWED_HOSTS` | Yes | `yourapp.sevalla.app,example.com` | Comma-separated domains |
| `MPESA_CONSUMER_KEY` | Yes | `<key>` | From M-Pesa Sandbox/Production |
| `MPESA_CONSUMER_SECRET` | Yes | `<secret>` | From M-Pesa Sandbox/Production |
| `MPESA_SHORTCODE` | Yes | `123456` | Your M-Pesa shortcode |
| `MPESA_PASSKEY` | Yes | `<passkey>` | Your M-Pesa passkey |
| `MPESA_ENVIRONMENT` | Yes | `production` | `sandbox` or `production` |
| `MPESA_CALLBACK_URL` | Yes | `https://yourapp.sevalla.app/api/payments/callback/` | Must be HTTPS and reachable |
| `MPESA_ADMIN_TOKEN` | Yes | `<random-token>` | For admin API access |
| `MPESA_EXPRESS_SHORTCODE` | Yes | `123456` | Same as SHORTCODE usually |
| `CORS_ALLOWED_ORIGINS` | Yes | `https://yourapp.sevalla.app` | Frontend origin |

## Troubleshooting

### Static Files Not Loading
1. Check `STATIC_ROOT` path exists
2. Verify `collectstatic` ran successfully
3. Enable WhiteNoise debug:
   ```python
   WHITENOISE_AUTOREFRESH = True  # Development only
   ```

### Database Migrations Failed
```bash
# SSH into your Sevalla service and run:
python manage.py migrate --no-input
```

### M-Pesa Callback Not Working
1. Verify `MPESA_CALLBACK_URL` is publicly accessible
2. Check firewall/security group allows POST requests
3. Review M-Pesa logs for callback errors

### CORS Issues
1. Ensure `CORS_ALLOWED_ORIGINS` matches frontend domain exactly
2. Include protocol: `https://yourapp.sevalla.app`

## Local Testing Before Deployment

```bash
# 1. Build frontend
npm run build

# 2. Collect static files
cd tastybites
python manage.py collectstatic --no-input

# 3. Test with local Gunicorn
gunicorn tastybites.wsgi:application --bind 0.0.0.0:8000

# 4. Visit http://localhost:8000
```

## Scaling & Performance

- **Workers**: Adjust `--workers` in start command (2 × cores recommended)
- **Threads**: Add `--threads 2` for threading
- **Timeout**: Increase `--timeout` if requests are timing out (default 30s)

Example for 4-core machine:
```bash
gunicorn tastybites.wsgi:application --bind 0.0.0.0:$PORT --workers 8 --threads 2 --worker-class gthread
```

## Monitoring & Logs

**Sevalla Dashboard**:
1. Go to Service → Logs
2. Monitor error rates and response times
3. Set up alerts for high error rates

**Manual Log Access**:
```bash
# Via Sevalla dashboard or SSH
tail -f /app/logs/gunicorn.log
```

## Next Steps

1. ✅ Configure all environment variables in Sevalla dashboard
2. ✅ Provision PostgreSQL database
3. ✅ Deploy backend service
4. ✅ Deploy frontend (if separate) or verify static files via backend
5. ✅ Test API endpoints and payment flow
6. ✅ Set up monitoring and logging
7. ✅ Configure custom domain (if applicable)

---

**Need Help?**
- Sevalla Docs: https://sevalla.io/docs
- Django Deployment: https://docs.djangoproject.com/en/stable/howto/deployment/
- WhiteNoise: http://whitenoise.evans.io/
