# SEVALLA DEPLOYMENT QUICK START

Quick reference guide for deploying Tasty Bites Hub to Sevalla.

## Overview

- **Frontend**: React + Vite (builds to `dist/`)
- **Backend**: Django + REST API
- **Database**: PostgreSQL (or use external DB)
- **Static Files**: Served via WhiteNoise
- **Server**: Gunicorn

## Pre-Deployment Checklist

- [ ] All environment variables documented in `.env.example`
- [ ] Dockerfile verified to build frontend → collect static files → run Gunicorn
- [ ] Database plan (Sevalla PostgreSQL or external)
- [ ] M-Pesa credentials obtained (Sandbox or Production)
- [ ] Admin user created (local testing)

## Sevalla Dashboard Setup

### 1. Create Backend Service

**Service Type**: Docker or Python

**Build Command** (if not using Docker):
```bash
cd tastybites && pip install -r requirements.txt && python manage.py migrate && python manage.py collectstatic --noinput
```

**Start Command**:
```bash
gunicorn tastybites.wsgi:application --bind 0.0.0.0:$PORT --workers 2 --timeout 30
```

### 2. Set Environment Variables

Copy all from `.env.example` and fill in:

**Critical Variables**:
- `SECRET_KEY` - Generate with: `python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"`
- `DATABASE_URL` - From Sevalla PostgreSQL or external database
- `DEBUG` - Must be `False`
- `ALLOWED_HOSTS` - Your Sevalla domain
- `MPESA_*` - From M-Pesa Safaricom dashboard

### 3. Database Provisioning

Option A: **Sevalla PostgreSQL**
1. Create PostgreSQL instance in Sevalla dashboard
2. Copy connection string to `DATABASE_URL`
3. Set `DATABASE_URL=postgresql://user:pass@host:5432/dbname`

Option B: **External Database**
1. Use Neon, Supabase, or similar
2. Verify connection is accessible from Sevalla
3. Set `DATABASE_URL` to external connection string

### 4. Deploy

Push to your repository - Sevalla will automatically:
1. Build frontend (via Dockerfile Stage 1)
2. Collect static files (via Dockerfile Stage 2)
3. Start Gunicorn server
4. Serve requests

## Testing After Deployment

```bash
# Test backend API
curl https://your-app.sevalla.app/api/payments/config/

# Test admin login
curl -X POST https://your-app.sevalla.app/api/payments/admin/signin/ \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"your-password"}'

# Test health check
curl https://your-app.sevalla.app/api/payments/config/ | jq .
```

## Local Pre-Deployment Build Test

```bash
# Build frontend
npm install && npm run build

# Install backend deps
cd tastybites && pip install -r requirements.txt

# Run migrations (requires DATABASE_URL set or uses SQLite)
python manage.py migrate

# Collect static files
python manage.py collectstatic --no-input

# Test Gunicorn
gunicorn tastybites.wsgi:application --bind 127.0.0.1:8000

# Visit: http://localhost:8000
```

## Docker Build Test

```bash
# Build Docker image
docker build -t tasty-bites .

# Run container
docker run -e DEBUG=False -e SECRET_KEY=test -e DATABASE_URL=sqlite:///db.sqlite3 -p 8000:8000 tasty-bites

# Visit: http://localhost:8000
```

## Troubleshooting

### Static Files Not Loading
- Verify `STATIC_ROOT = BASE_DIR / 'staticfiles'` in settings.py
- Run `python manage.py collectstatic --no-input`
- Check Sevalla logs for static file serving errors

### Database Connection Failed
- Verify `DATABASE_URL` is correct and accessible
- Check firewall rules allow connection from Sevalla
- Test connection locally: `psql $DATABASE_URL`

### M-Pesa Payment Not Working
- Verify `MPESA_CALLBACK_URL` is HTTPS and publicly accessible
- Check M-Pesa credentials are correct
- Review M-Pesa logs in dashboard

### CORS Errors
- Verify `CORS_ALLOWED_ORIGINS` matches frontend domain exactly
- Include protocol: `https://your-app.sevalla.app`
- Check `CSRF_TRUSTED_ORIGINS` includes frontend origin

## File Reference

| File | Purpose |
|------|---------|
| `Dockerfile` | Multi-stage build: frontend + backend |
| `.env.example` | Template for all environment variables |
| `SEVALLA_DEPLOYMENT.md` | Detailed deployment guide |
| `generate_deployment_config.py` | Generate SECRET_KEY and ADMIN_TOKEN |
| `scripts/pre-deployment-check.sh` | Local build verification |
| `package.json` | Frontend dependencies and build script |
| `tastybites/requirements.txt` | Backend Python dependencies |
| `tastybites/settings.py` | Django configuration with Sevalla support |

## Support

- Sevalla Docs: https://sevalla.io/docs
- Django Docs: https://docs.djangoproject.com/
- WhiteNoise: http://whitenoise.evans.io/
- M-Pesa Daraja: https://developer.safaricom.co.ke/

---

**Questions?** Check logs in Sevalla dashboard or review `SEVALLA_DEPLOYMENT.md` for detailed information.
