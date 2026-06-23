# Sevalla Deployment Setup Guide

**Generated:** 2026-06-23

## Your Deployment Details

| Item | Value |
|------|-------|
| **Docker Image** | `omollo001/tasty-bites-hub:latest` |
| **Sevalla App Name** | `tastybites-w2ip3.sevalla.app` |
| **Database URL** | `postgres://accurate-coral-guppy:sqhmelckdfvq@glorious-blush-antelope-i1a2a-postgresql.glorious-blush-antelope-i1a2a.svc.cluster.local:5432/glorious-blush-antelope` |
| **Django Secret Key** | `3#7vm@jrz7^38!8u%j6n*5o#%p#e+o^*0939xkfp1(t-w%37+z` |

---

## Step 1: Create App on Sevalla Dashboard

1. Go to **https://dashboard.sevalla.app**
2. Sign in with your credentials
3. Click **"New"** → **"Web Service"**
4. Select **"Deploy from a Docker image"**
5. Enter Docker Image: `omollo001/tasty-bites-hub:latest`
6. Click **"Create Web Service"**
7. **Save your App ID** (you'll need it for GitHub secrets)

---

## Step 2: Configure Environment Variables

Once your app is created, go to **Settings** → **Environment Variables** and add these variables:

```env
DJANGO_SECRET_KEY=3#7vm@jrz7^38!8u%j6n*5o#%p#e+o^*0939xkfp1(t-w%37+z
DJANGO_DEBUG=False
DATABASE_URL=postgres://accurate-coral-guppy:sqhmelckdfvq@glorious-blush-antelope-i1a2a-postgresql.glorious-blush-antelope-i1a2a.svc.cluster.local:5432/glorious-blush-antelope
PGSSLMODE=require
ALLOWED_HOSTS=tastybites-w2ip3.sevalla.app,.sevalla.app
CORS_ALLOWED_ORIGINS=https://tastybites-w2ip3.sevalla.app
CSRF_TRUSTED_ORIGINS=https://tastybites-w2ip3.sevalla.app
MPESA_CONSUMER_KEY=kwCn9sG1ySJ6NWcHduKaXOAnNu6DkbwI9v096WTmsHG8XMVq
MPESA_CONSUMER_SECRET=6PcwyDSoN8R4V4VxVUAP9uGCGYi9Cm67xDRUtiUCA0RzXvXIE8FtCEc1zYPOnZXu
MPESA_ADMIN_TOKEN=dev-admin-token
MPESA_CALLBACK_URL=https://tastybites-w2ip3.sevalla.app/api/payments/callback/
RUN_MIGRATIONS=true
PORT=8000
```

---

## Step 3: Deploy the App

1. Click **"Deploy"** on Sevalla dashboard
2. Wait for deployment to complete (5-10 minutes)
3. Once live, visit **https://tastybites-w2ip3.sevalla.app**

---

## Step 4: Update GitHub Repository Secrets

Add these secrets to your GitHub repository (Settings → Secrets and variables → Actions):

| Secret Name | Value |
|-------------|-------|
| `DOCKER_USERNAME` | `omollo001` |
| `DOCKER_PASSWORD` | *Your Docker Hub password* |
| `SEVALLA_APP` | *Your Sevalla App ID from Step 1* |
| `SEVALLA_API_URL` | *From Sevalla app settings/deployment webhook* |
| `SEVALLA_API_TOKEN` | *From Sevalla account settings/API tokens* |
| `SEVALLA_DOMAIN` | `tastybites-w2ip3.sevalla.app` |

### How to find SEVALLA_API_URL and SEVALLA_API_TOKEN:

1. In Sevalla dashboard, go to **Account Settings** or **API Settings**
2. Look for **"Deployment Webhook URL"** → copy as `SEVALLA_API_URL`
3. Look for **"API Token"** → copy as `SEVALLA_API_TOKEN`
4. Or from app settings, find **"Deploy Hook"** or **"Deployment Settings"**

---

## Step 5: Test GitHub Actions

1. Push a commit to `main` or `master` branch:
   ```bash
   git add .
   git commit -m "Deploy to Sevalla"
   git push origin main
   ```

2. Go to **GitHub repository** → **Actions**
3. Watch the workflow run:
   - ✅ Build Docker image
   - ✅ Push to Docker Hub
   - ✅ Deploy to Sevalla

---

## Troubleshooting

### If deployment shows "App not found"
- Verify `SEVALLA_APP` secret matches your Sevalla app ID

### If database connection fails
- Verify `DATABASE_URL` is correct
- Check PostgreSQL is accessible from Sevalla network
- Confirm `PGSSLMODE=require` is set

### If migrations don't run
- Check `RUN_MIGRATIONS=true` env var is set
- View app logs on Sevalla dashboard
- Run manually via Sevalla console: `python manage.py migrate`

---

## Production Checklist

- [ ] App created on Sevalla
- [ ] Environment variables configured
- [ ] Database is accessible
- [ ] Docker image pushed to Docker Hub
- [ ] GitHub secrets configured
- [ ] First deployment successful
- [ ] App accessible at `https://tastybites-w2ip3.sevalla.app`
- [ ] M-Pesa credentials updated (if using production)
- [ ] Email settings configured (if needed)

