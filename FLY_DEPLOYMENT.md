# Fly.io Deployment Guide

This guide walks you through deploying **Tasty Bites Hub** (backend + frontend) to Fly.io entirely in the cloud. No local hosting needed.

## Prerequisites

1. **Fly CLI installed**
   ```bash
   # Install from: https://fly.io/docs/hands-on/install/
   fly --version
   ```

2. **Fly account** (free tier available)
   ```bash
   fly auth signup  # or fly auth login if you have an account
   ```

3. **Docker** (for local image building) — already have this ✓

## Quick Start (Automated)

### Option 1: Windows PowerShell

```powershell
cd c:\Users\omoll\tasty-bites-hub
.\scripts\fly-deploy.ps1 -AppName "tasty-bites-hub" -DbAppName "tasty-bites-db"
```

### Option 2: macOS / Linux (Bash)

```bash
cd ~/tasty-bites-hub
bash scripts/fly-deploy.sh tasty-bites-hub tasty-bites-db
```

The script will:
1. ✓ Create your Fly app
2. ✓ Create a Postgres database
3. ✓ Set all environment variables and secrets
4. ✓ Deploy the Docker image
5. ✓ Run migrations and collectstatic

**Then skip to "Access Your App" section below.**

---

## Manual Deployment (Step by Step)

If you prefer manual control, follow these steps:

### Step 1: Install Fly CLI and Log In

```bash
# Install
curl -L https://fly.io/install.sh | sh

# Or on Windows, use:
# https://fly.io/docs/hands-on/install/

# Log in
fly auth login
```

### Step 2: Create Your Fly App

```bash
fly apps create tasty-bites-hub
```

Or let Fly choose a name (you'll need to update ALLOWED_HOSTS later):
```bash
fly launch --no-deploy
```

### Step 3: Create a Postgres Database

Fly.io free tier includes a small Postgres instance. Create it:

```bash
fly postgres create \
  --name tasty-bites-db \
  --region ord \
  --vm-size shared-cpu-1x \
  --initial-cluster-size 1 \
  --skip-launch
```

Replace `ord` with your nearest region if needed. See: `fly platform regions`

### Step 4: Attach Database to App

```bash
fly postgres attach --app tasty-bites-hub tasty-bites-db
```

This automatically sets `DATABASE_URL` in your app secrets. Wait a moment for it to complete.

### Step 5: Generate Secrets

```bash
# Generate Django SECRET_KEY
python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"

# Generate ADMIN_TOKEN (32 random chars)
openssl rand -hex 16

# Your app domain (will be created after deploy)
APP_DOMAIN="tasty-bites-hub.fly.dev"
```

### Step 6: Set Environment Variables

```bash
fly secrets set \
  --app tasty-bites-hub \
  DJANGO_SECRET_KEY="<paste-the-key-from-step-5>" \
  DEBUG="False" \
  DJANGO_SETTINGS_MODULE="tastybites.settings" \
  ALLOWED_HOSTS="tasty-bites-hub.fly.dev" \
  CORS_ALLOWED_ORIGINS="https://tasty-bites-hub.fly.dev" \
  PGSSLMODE="require" \
  ADMIN_TOKEN="<paste-the-token-from-step-5>" \
  PORT="8000"
```

### Step 7: Deploy

```bash
fly deploy --app tasty-bites-hub --remote-only
```

This builds and deploys your Docker image. Takes 3–5 minutes.

### Step 8: Run Migrations

Once deployed, run migrations inside the app container:

```bash
fly ssh console --app tasty-bites-hub
```

Then in the console:
```bash
cd /app
python manage.py migrate --noinput
python manage.py collectstatic --noinput
exit
```

---

## Access Your App

Once deployment is complete:

| URL | Purpose |
|-----|---------|
| `https://tasty-bites-hub.fly.dev` | Frontend (React/Vite) |
| `https://tasty-bites-hub.fly.dev/api` | Backend API |
| `https://tasty-bites-hub.fly.dev/admin` | Django admin |
| `https://tasty-bites-hub.fly.dev/api/health/` | Health check |

## Useful Commands

### View Logs
```bash
fly logs --app tasty-bites-hub
```

### SSH Into Container
```bash
fly ssh console --app tasty-bites-hub
```

### Restart App
```bash
fly restart --app tasty-bites-hub
```

### Redeploy After Code Changes
```bash
fly deploy --app tasty-bites-hub --remote-only
```

### View Secrets
```bash
fly secrets list --app tasty-bites-hub
```

### Update a Secret
```bash
fly secrets set --app tasty-bites-hub KEY="new_value"
```

## Troubleshooting

### App won't start / 502 errors
```bash
fly logs --app tasty-bites-hub
# Look for WSGI DB connection errors, app crashes, etc.
```

### Database connection fails
```bash
fly ssh console --app tasty-bites-hub
python scripts/check_db_diagnostics.py
```

### Static files not loading
```bash
fly ssh console --app tasty-bites-hub
python manage.py collectstatic --noinput --clear
```

### Out of memory
- Fly free tier has 256MB RAM
- If your app needs more, upgrade the VM size

### Need to restart
```bash
fly restart --app tasty-bites-hub
```

## Free Tier Limits

- **Compute**: 3 shared-cpu-1x VMs (256MB RAM each)
- **Database**: 1 small Postgres (1GB storage, 3 connections)
- **Bandwidth**: 160GB/month
- **Data**: 1GB included

For small apps, this is plenty. Upgrade anytime if needed.

## Regional Deployment

Fly deploys globally by default. To use specific regions:

```bash
# Deploy to specific region (e.g., "iad" for US East)
fly regions add iad --app tasty-bites-hub
fly regions set iad --app tasty-bites-hub
```

Available regions: `fly platform regions`

## What's in fly.toml

The `fly.toml` file configures:
- App name
- Build: uses your `Dockerfile`
- Services: HTTP/HTTPS on ports 80/443
- Forwards to port 8000 (Django/Gunicorn)

You can edit it manually if needed, then redeploy:
```bash
fly deploy --app tasty-bites-hub
```

## Monitoring

Fly provides a free monitoring dashboard:
- Dashboard: https://fly.io/dashboard
- Metrics, logs, deployment history all visible

## Rolling Back

If a deployment breaks:
```bash
fly releases --app tasty-bites-hub
# Find the previous release ID, then:
fly releases rollback <release-id> --app tasty-bites-hub
```

## Next Steps

1. ✓ App is now live at `https://tasty-bites-hub.fly.dev`
2. Update your frontend `.env` or build args to point to the live API:
   ```
   VITE_API_URL=https://tasty-bites-hub.fly.dev
   ```
3. Test the app: visit https://tasty-bites-hub.fly.dev
4. Set up a custom domain if desired (Fly supports custom DNS)

## Support

- Fly Docs: https://fly.io/docs
- Community: https://community.fly.io
- Status: https://status.fly.io
