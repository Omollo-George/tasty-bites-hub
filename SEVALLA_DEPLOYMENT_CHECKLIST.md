# Sevalla Deployment Checklist

Complete this checklist before deploying to Sevalla.

## Pre-Deployment Setup

### 1. Environment Variables ✓
- [ ] Copy `.env.example` to `.env.local` (local testing)
- [ ] Generate `SECRET_KEY`: `python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"`
- [ ] Generate `MPESA_ADMIN_TOKEN`: `python generate_deployment_config.py`
- [ ] Obtain M-Pesa credentials from Safaricom Daraja
- [ ] Set `DEBUG=False` for production
- [ ] Verify `ALLOWED_HOSTS` includes Sevalla domain
- [ ] Verify `CORS_ALLOWED_ORIGINS` includes frontend domain

### 2. Database Preparation ✓
- [ ] Create PostgreSQL database (Sevalla or external)
- [ ] Verify database is accessible
- [ ] Record `DATABASE_URL` connection string
- [ ] Format: `postgresql://user:password@host:5432/dbname`

### 3. Local Build Test ✓
- [ ] Run: `npm install && npm run build`
- [ ] Verify `dist/` directory created
- [ ] Run: `pip install -r tastybites/requirements.txt`
- [ ] Run: `python manage.py migrate`
- [ ] Run: `python manage.py collectstatic --noinput`
- [ ] Run: `gunicorn tastybites.wsgi:application --bind 127.0.0.1:8000`
- [ ] Verify static files serve at: `http://localhost:8000/`

### 4. Docker Build Test (Optional) ✓
- [ ] Build: `docker build -t tasty-bites .`
- [ ] Run: `docker run -p 8000:8000 -e SECRET_KEY=test -e DEBUG=False tasty-bites`
- [ ] Verify frontend loads

### 5. Code Changes ✓
- [ ] Commit all changes: `git add . && git commit -m "Prepare for Sevalla deployment"`
- [ ] Push to main branch: `git push origin main`
- [ ] Verify GitHub shows all commits

## Sevalla Dashboard Configuration

### 1. Create Backend Service
- [ ] Service type: Docker (recommended) or Python
- [ ] Repository: Connect GitHub repo
- [ ] Branch: main
- [ ] Root directory: `.` (project root)

### 2. Configure Build & Start
If using **Docker**:
- Build command is automatic (uses Dockerfile)

If using **Python**:
- [ ] Build command: 
  ```
  cd tastybites && pip install -r requirements.txt && python manage.py migrate && python manage.py collectstatic --noinput
  ```
- [ ] Start command: 
  ```
  gunicorn tastybites.wsgi:application --bind 0.0.0.0:$PORT --workers 2 --timeout 30
  ```

### 3. Set Environment Variables (in Sevalla Dashboard)
- [ ] `DEBUG=False`
- [ ] `SECRET_KEY=<generated>`
- [ ] `ALLOWED_HOSTS=your-app.sevalla.app`
- [ ] `DATABASE_URL=postgresql://...`
- [ ] `CORS_ALLOWED_ORIGINS=https://your-app.sevalla.app`
- [ ] `CSRF_TRUSTED_ORIGINS=https://your-app.sevalla.app`
- [ ] `SESSION_COOKIE_SECURE=True`
- [ ] `SESSION_COOKIE_HTTPONLY=True`
- [ ] `CSRF_COOKIE_SECURE=True`
- [ ] `SECURE_SSL_REDIRECT=True`
- [ ] `MPESA_CONSUMER_KEY=<from dashboard>`
- [ ] `MPESA_CONSUMER_SECRET=<from dashboard>`
- [ ] `MPESA_SHORTCODE=<your shortcode>`
- [ ] `MPESA_EXPRESS_SHORTCODE=<your shortcode>`
- [ ] `MPESA_PASSKEY=<from dashboard>`
- [ ] `MPESA_ENVIRONMENT=production` (or sandbox for testing)
- [ ] `MPESA_CALLBACK_URL=https://your-app.sevalla.app/api/payments/callback/`
- [ ] `MPESA_ADMIN_TOKEN=<generated>`
- [ ] `MPESA_TO_KES_RATE=1`

### 4. Create Database
- [ ] Option A: Use Sevalla PostgreSQL
  - [ ] Create PostgreSQL instance
  - [ ] Copy connection string
  - [ ] Set as `DATABASE_URL`
  
  - [ ] Option B: Use external database (Neon, Supabase, etc.)
  - [ ] Verify accessibility from Sevalla
  - [ ] Set as `DATABASE_URL`

## Deployment

### 1. Deploy Service
- [ ] Click "Deploy" in Sevalla dashboard
- [ ] Wait for build to complete (~5-10 minutes)
- [ ] Verify build succeeded (check logs)

### 2. Verify Deployment
- [ ] Visit `https://your-app.sevalla.app/`
- [ ] Verify page loads with static files
- [ ] Check browser console for errors

### 3. Test API
```bash
# Test config endpoint
curl https://your-app.sevalla.app/api/payments/config/

# Test admin login
curl -X POST https://your-app.sevalla.app/api/payments/admin/signin/ \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"your-password"}'
```

### 4. Create Admin User (if needed)
- [ ] SSH into service: `sevalla shell <service-name>`
- [ ] Create user: `python manage.py createsuperuser`
- [ ] Or use admin API with generated token

## Post-Deployment Testing

### 1. Frontend
- [ ] [ ] Homepage loads
- [ ] [ ] Menu displays
- [ ] [ ] Cart functionality works
- [ ] [ ] Order creation flow works
- [ ] [ ] Payment method selection works

### 2. Admin Dashboard
- [ ] [ ] Admin login works
- [ ] [ ] Settings page loads
- [ ] [ ] Delivery rate editing works
- [ ] [ ] Orders display
- [ ] [ ] Order details visible

### 3. Payments (M-Pesa)
- [ ] [ ] Payment initiation works
- [ ] [ ] STK Push prompt appears
- [ ] [ ] Callback receives data
- [ ] [ ] Order status updates
- [ ] [ ] Test phone can complete payment

### 4. Static Files & Caching
- [ ] [ ] CSS/JS files load from `/static/`
- [ ] [ ] Images display
- [ ] [ ] No 404 errors in console
- [ ] [ ] WhiteNoise compression working

## Monitoring & Maintenance

### 1. Logs
- [ ] Check logs daily for errors
- [ ] Monitor payment callback failures
- [ ] Watch for database connection issues

### 2. Performance
- [ ] Monitor response times
- [ ] Check CPU/memory usage
- [ ] Adjust workers if needed: `--workers 4` for higher load

### 3. Updates
- [ ] Test locally before pushing to Sevalla
- [ ] Keep M-Pesa credentials secure
- [ ] Backup database regularly
- [ ] Monitor Django security updates

## Troubleshooting Reference

| Issue | Solution |
|-------|----------|
| Build fails | Check logs, verify dependencies, ensure Node version ≥20 |
| Static files 404 | Run `collectstatic`, check STATIC_ROOT path |
| Database error | Verify DATABASE_URL, check firewall, test connection |
| M-Pesa callback fails | Verify MPESA_CALLBACK_URL is HTTPS and accessible |
| CORS errors | Verify CORS_ALLOWED_ORIGINS matches frontend domain |
| Login fails | Check MPESA_ADMIN_TOKEN, verify user exists |

---

**Status**: Ready for Sevalla deployment ✓

**Questions?** Refer to:
- [SEVALLA_DEPLOYMENT.md](../SEVALLA_DEPLOYMENT.md) - Detailed guide
- [SEVALLA_QUICKSTART.md](../SEVALLA_QUICKSTART.md) - Quick reference
- [.env.example](../.env.example) - Environment variables template
