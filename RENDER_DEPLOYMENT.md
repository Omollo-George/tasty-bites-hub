# Render Deployment Guide

This repository is now configured for Render deployment using Docker.

## What was added
- `render.yaml` — Render blueprint config for the web service.

## Steps to deploy on Render

1. Create a Render account and connect your GitHub repository.

2. In your repository, make sure `render.yaml` exists at the root.

3. Generate required secrets locally:

```bash
cd c:\Users\omoll\tasty-bites-hub
python generate_secrets.py
```

4. In the Render Dashboard, create a new service using `render.yaml`.
   - Service type: `Web Service`
   - Environment: `Docker`
   - Dockerfile path: `Dockerfile`
   - Health check path: `/api/health/`

5. Configure the backend environment variables from the generated secrets:
   - `DJANGO_SECRET_KEY`
   - `MPESA_ADMIN_TOKEN`
   - `DJANGO_DEBUG=False`
   - `ALLOWED_HOSTS=*.onrender.com,localhost`
   - `CORS_ALLOWED_ORIGINS=https://<your-render-service>.onrender.com`
   - `MPESA_CALLBACK_URL=https://<your-render-service>.onrender.com/api/payments/callback/`
   - `EMAIL_HOST_USER=<your-email>`
   - `EMAIL_HOST_PASSWORD=<your-email-app-password>`
   - `DATABASE_URL=postgresql://user:pass@host:5432/dbname?sslmode=require`

6. Configure frontend environment variables on Render (if using a separate static site):
   - `VITE_API_URL=https://<your-render-service>.onrender.com/api`

7. Deploy.

## Notes

- The backend uses the root `Dockerfile` and serves the frontend `dist` output via Django and Whitenoise.
- If you prefer Render-managed Postgres, create a Render Postgres database and copy its `DATABASE_URL` into the web service.
- After deployment, your app should be available at `https://<your-render-service>.onrender.com`.

## Admin and staff URLs on Render

- Admin login: `https://<your-render-service>.onrender.com/admin/login`
- Staff login: `https://<your-render-service>.onrender.com/staff/login`

If you want, I can also add a Render database connector block to `render.yaml` so the deployment can create the database automatically.