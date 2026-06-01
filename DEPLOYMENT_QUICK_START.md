# Render Deployment Setup - Quick Reference

## What's New

This project is now configured for simultaneous deployment of both the frontend and backend on Render.

### New Files Created

| File | Purpose |
|------|---------|
| `render.yaml` | Render deployment configuration (services, build, start commands, env vars) |
| `Procfile` | Legacy Heroku-style process file for Render |
| `tastybites/requirements.txt` | Python/Django dependencies for backend |
| `RENDER_DEPLOYMENT.md` | Comprehensive deployment guide |
| `DEPLOYMENT.md` | Environment variable examples and configuration |
| `.env.example` | Example environment variables for local development |
| `src/lib/api-config.ts` | Frontend API configuration utility |
| `generate_secrets.py` | Script to generate secure secrets for deployment |
| `validate-deployment.sh` | Shell script to validate deployment setup |
| `validate-deployment.ps1` | PowerShell script to validate deployment setup |

### Modified Files

| File | Changes |
|------|---------|
| `tastybites/tastybites/settings.py` | Added production security, WhiteNoise, static files config, CORS setup |
| `tastybites/tastybites/urls.py` | Added health check endpoint `/api/health/` |
| `.gitignore` | Added environment files and Python cache entries |

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│         Render Platform (render.com)                    │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────────────┐          ┌─────────────────────┐ │
│  │ Static Site      │          │ Web Service         │ │
│  │ (Frontend)       │          │ (Backend)           │ │
│  ├──────────────────┤          ├─────────────────────┤ │
│  │ React/Vite Build │          │ Django + Gunicorn   │ │
│  │ Served from /    │◄────────►│ API at /api/*       │ │
│  │ VITE_API_URL=... │          │ Health at /api/...  │ │
│  │                  │          │                     │ │
│  │ Build: npm build │          │ Build: pip install  │ │
│  │ Env: Node        │          │ Env: Python 3       │ │
│  └──────────────────┘          └─────────────────────┘ │
│                                                          │
└─────────────────────────────────────────────────────────┘
         │                              │
         └──────────────────────────────┘
           Frontend calls Backend API
```

## Deployment Steps (Quick Start)

### 1. Prepare Repository

```bash
# Ensure all deployment files are in version control
git add render.yaml Procfile RENDER_DEPLOYMENT.md DEPLOYMENT.md .env.example
git add tastybites/requirements.txt
git add src/lib/api-config.ts
git add validate-deployment.sh validate-deployment.ps1
git add generate_secrets.py
git commit -m "Add Render deployment configuration"
git push origin main
```

### 2. Generate Deployment Secrets

Run locally to generate secure values:

```bash
python generate_secrets.py
```

Copy the output values - you'll need them in the next step.

### 3. Deploy to Render

#### Option A: Using Blueprint (Recommended)

1. Go to https://dashboard.render.com
2. Click "New +" → "Blueprint"
3. Connect your GitHub repository
4. Name your service group (e.g., "tasty-bites-hub")
5. Fill in environment variables from `generate_secrets.py` output
6. Click "Create"

Render will automatically create both services and deploy them.

#### Option B: Manual Service Creation

See `RENDER_DEPLOYMENT.md` for detailed instructions.

### 4. Configure M-Pesa

1. Get your deployed backend URL from Render dashboard
2. Update M-Pesa callback URL in Safaricom settings:
   - `https://your-backend-url.onrender.com/api/payments/callback/`
3. Test with M-Pesa STK Push

### 5. Verify Deployment

```bash
# Frontend should load
curl https://your-frontend-url.onrender.com

# Backend should respond
curl https://your-backend-url.onrender.com/api/health/

# API should be reachable from frontend
# (Check browser console for any CORS errors)
```

## Environment Variables

### Frontend (Static Site)

```
VITE_API_URL=https://your-backend-url.onrender.com/api
```

This is automatically set by `render.yaml` based on backend service URL.

### Backend (Web Service)

Required (generate with `generate_secrets.py`):
- `DJANGO_SECRET_KEY` - Secure random key
- `MPESA_ADMIN_TOKEN` - Secure admin token

Important:
- `DJANGO_DEBUG=False` - Must be False in production
- `ALLOWED_HOSTS=*.onrender.com,localhost`
- `CORS_ALLOWED_ORIGINS=<frontend-url>`
- `MPESA_CALLBACK_URL=<backend-url>/api/payments/callback/`

M-Pesa Credentials (update with production values):
- `MPESA_ENVIRONMENT=sandbox` or `production`
- `MPESA_CALLBACK_URL` - Updated for Render domain

Email (required for features that send emails):
- `EMAIL_HOST_USER` - Gmail address
- `EMAIL_HOST_PASSWORD` - Gmail app password

## Local Development

The project still works locally with both services:

```bash
# Install all dependencies
npm install
pip install -r tastybites/requirements.txt

# Run both services
npm run dev

# Or run separately:
npm run dev:client    # Frontend on :5174
npm run dev:server    # Backend on :8000
```

The Vite dev server proxies `/api` requests to `localhost:8000`.

## Troubleshooting

### 502 Bad Gateway

Check backend logs in Render dashboard:
- Verify all environment variables are set
- Run migrations: `python tastybites/manage.py migrate`
- Check for missing Python dependencies

### Frontend Can't Reach Backend

- Verify `VITE_API_URL` environment variable is set
- Check CORS settings: `CORS_ALLOWED_ORIGINS` must include frontend domain
- Rebuild frontend after changing environment variables

### Build Failures

Run validation script to catch issues early:

```bash
# Windows
.\validate-deployment.ps1

# Linux/Mac
./validate-deployment.sh
```

## File Reference

**Core Deployment:**
- `render.yaml` - Main deployment configuration
- `Procfile` - Process definitions
- `RENDER_DEPLOYMENT.md` - Full deployment guide

**Backend:**
- `tastybites/requirements.txt` - Python dependencies
- `tastybites/tastybites/settings.py` - Django settings (updated for production)
- `tastybites/tastybites/urls.py` - URL routing with health endpoint

**Frontend:**
- `src/lib/api-config.ts` - API configuration utility
- `vite.config.ts` - Vite configuration (includes dev proxy)

**Documentation:**
- `DEPLOYMENT.md` - Environment variables reference
- `RENDER_DEPLOYMENT.md` - Complete deployment guide
- `.env.example` - Local development environment template

**Utilities:**
- `generate_secrets.py` - Generate secure deployment secrets
- `validate-deployment.sh` - Deployment validation (Linux/Mac)
- `validate-deployment.ps1` - Deployment validation (Windows)

## Next Steps

1. ✅ Review `RENDER_DEPLOYMENT.md` for comprehensive guide
2. ✅ Run `generate_secrets.py` to create deployment secrets
3. ✅ Push code to GitHub
4. ✅ Create Render blueprint or deploy manually
5. ✅ Monitor logs and configure M-Pesa
6. ✅ Test payment flow end-to-end

## Support

- Render Docs: https://render.com/docs
- Django Deployment: https://docs.djangoproject.com/en/6.0/howto/deployment/
- Vite Guide: https://vitejs.dev/guide/

For issues, check the logs in your Render dashboard or review the deployment guides included in this repository.
