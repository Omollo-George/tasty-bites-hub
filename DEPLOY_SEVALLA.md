# Deploy Tasty Bites to Sevalla - Complete Step-by-Step Guide

This guide walks you through deploying the Tasty Bites app to Sevalla with zero prior setup knowledge.

---

## Prerequisites (One-time Setup)

### 1. Install Docker Desktop
- Download: https://www.docker.com/products/docker-desktop
- Install and restart your computer.
- Verify in PowerShell:
```powershell
docker --version
```
Expected: `Docker version X.X.X`

### 2. Create Docker Hub Account
- Go to https://hub.docker.com
- Sign up (free).
- Remember your **username** and **password**.

### 3. Create Sevalla Account & Database
- Go to https://sevalla.app (or your Sevalla provider).
- Create an account.
- Create a new **PostgreSQL database**.
- Copy the database connection string (looks like: `postgresql://user:pass@host:5432/dbname`).
- Create a new **Web Service** (leave deployment source blank for now).

---

## Deployment Steps

### Step 1: Generate Django Secret Key

Run this in PowerShell to generate a secure secret key:

```powershell
python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
```

**Copy the output** — you'll need it in Step 5.

Example output:
```
abcd1234efgh5678ijkl9012mnop3456
```

---

### Step 2: Build Docker Image Locally

Navigate to the repository root and build:

```powershell
cd "c:\Users\omoll\OneDrive\Desktop\tasty-bites-hub"
docker build -t tasty-bites:latest .
```

**Expected output (last few lines):**
```
...
Successfully built abc123def456
```

**This may take 2-5 minutes.** Wait for it to complete.

---

### Step 3: Log In to Docker Hub

In PowerShell, authenticate with Docker Hub:

```powershell
docker login
```

**When prompted:**
- Enter your Docker Hub **username**
- Enter your Docker Hub **password** (or personal access token)

Expected output:
```
Login Succeeded
```

---

### Step 4: Tag the Image

Replace `YOUR_DOCKER_USERNAME` with your actual Docker Hub username:

```powershell
docker tag tasty-bites:latest YOUR_DOCKER_USERNAME/tasty-bites:latest
```

Example (if your username is `johnsmith`):
```powershell
docker tag tasty-bites:latest johnsmith/tasty-bites:latest
```

---

### Step 5: Push to Docker Hub

```powershell
docker push YOUR_DOCKER_USERNAME/tasty-bites:latest
```

**Expected output:**
```
...
latest: digest: sha256:abc123def456... size: 5000
```

**This may take 2-10 minutes.** Wait for completion.

---

### Step 6: Configure Sevalla App

1. Go to your **Sevalla dashboard**.
2. Select the **Web Service** you created.
3. Go to **Deployment → Edit Deployment**.
4. Select **Container Image**.
5. Enter image URL:
```
YOUR_DOCKER_USERNAME/tasty-bites:latest
```

6. Click **Save** and wait for it to pull the image (1-2 minutes).

---

### Step 7: Set Environment Variables on Sevalla

In Sevalla dashboard, go to **Settings → Environment Variables** and add these (one by one):

| Variable | Value | Notes |
|----------|-------|-------|
| `DJANGO_SECRET_KEY` | `<paste from Step 1>` | The secret key you generated |
| `DEBUG` | `False` | Production mode |
| `DJANGO_SETTINGS_MODULE` | `tastybites.settings` | Django module |
| `DATABASE_URL` | `<your Sevalla DB URL>` | From Sevalla → Database → Connection String; append `?sslmode=require` if the string is missing SSL settings |
| `PGSSLMODE` | `require` | Optional: set when your database requires SSL |
| `ALLOWED_HOSTS` | `<your-sevalla-domain>,.sevalla.app` | Replace with your actual domain |
| `CORS_ALLOWED_ORIGINS` | `https://<your-sevalla-domain>` | Replace with your actual domain |
| `ADMIN_TOKEN` | `<generate a strong random string>` | Example: `super-secret-admin-2026` |
| `PORT` | `8000` | Listening port |
| `CORS_ALLOW_ALL_ORIGINS` | `False` | Restrict CORS to your domain |

**To find your Sevalla domain:**
- Go to **Sevalla dashboard → Web Service → Settings → Domain**.
- It looks like: `tasty-bites-abc123.sevalla.app`

---

### Step 8: Deploy on Sevalla

1. Click **Deploy** on Sevalla dashboard.
2. Wait for the container to start (2-5 minutes).
3. You'll see status: **Running**.

---

### Step 9: Run Database Migrations

Once the app is running, execute migrations via Sevalla's console:

1. Go to **Sevalla dashboard → Web Service → Console** (or **Shell**).
2. Run:
```bash
python manage.py migrate
```

Expected output:
```
Operations to perform:
  ...
Running migrations:
  ...
```

3. Run collectstatic:
```bash
python manage.py collectstatic --noinput
```

Expected output:
```
...
X static files collected.
```

---

### Step 10: Health Check

Once migrations are complete, test the app:

**Test 1: Backend API**
```powershell
$url = "https://<your-sevalla-domain>/api/health/"
Invoke-WebRequest -Uri $url -UseBasicParsing | Select-Object StatusCode
```

Expected: `StatusCode: 200`

**Test 2: Frontend**
```powershell
$url = "https://<your-sevalla-domain>/"
Invoke-WebRequest -Uri $url -UseBasicParsing | Select-Object StatusCode
```

Expected: `StatusCode: 200`

---

### Step 11: Monitor & Troubleshoot

**View logs:**
- Sevalla dashboard → **Web Service → Logs**

**Common issues:**
- **502 Bad Gateway**: App crashed. Check logs for errors.
- **DATABASE_URL error**: Make sure the database connection string is correct.
- **Static files missing**: Rerun `python manage.py collectstatic --noinput` via console.
- **CORS errors**: Check `CORS_ALLOWED_ORIGINS` matches your frontend domain.

**Restart the app:**
- Sevalla dashboard → **Web Service → Restart**

---

## Quick Reference: Variable Placeholders

Before copy-pasting commands, replace these:

- `YOUR_DOCKER_USERNAME` → Your Docker Hub username (e.g., `johnsmith`)
- `<your-sevalla-domain>` → Your Sevalla domain (e.g., `tasty-bites-abc123.sevalla.app`)
- `<your Sevalla DB URL>` → Your PostgreSQL connection string from Sevalla

---

## Rollback (If Needed)

If something goes wrong:

1. On Sevalla dashboard, go to **Deployments → History**.
2. Select the **previous working version**.
3. Click **Rollback**.

---

## Summary of What Happens

- **Step 2**: Builds the app (frontend + backend) into a Docker image.
- **Step 5**: Pushes the image to Docker Hub (public repository).
- **Step 6-7**: Tells Sevalla to use that image and configures settings.
- **Step 8**: Sevalla pulls the image and starts the container.
- **Step 9**: Initializes the database.
- **Step 10**: Verifies the app is running.

---

## Next Steps After Deployment

1. **Test key features** (login, orders, menu, payments).
2. **Set up monitoring** (Sevalla dashboard or third-party alerts).
3. **Configure custom domain** (if not using `.sevalla.app` domain).
4. **Enable HTTPS** (automatic on Sevalla).
5. **Set up backups** for the database.

---

## Support

- Sevalla Docs: https://docs.sevalla.app
- Django Docs: https://docs.djangoproject.com/
- Contact Sevalla support if deployment fails at their end.

Good luck! 🚀
