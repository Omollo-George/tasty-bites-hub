# Render Deployment Guide for Tasty Bites Hub

This project is configured for dual deployment on Render:
- **Frontend**: Static site (React/Vite)
- **Backend**: Web service (Django)

## Prerequisites

- GitHub repository with this code
- Render account (free tier available at render.com)
- Django Secret Key (generate one or use the provided)
- M-Pesa API credentials

## Deployment Steps

### 1. Fork/Upload Repository to GitHub

Push your code to GitHub. Render will deploy directly from your repository.

### 2. Create Render Services

#### Option A: Using render.yaml (Recommended)

1. Go to https://dashboard.render.com/
2. Click "New +" → "Blueprint"
3. Connect your GitHub repository
4. Render will automatically read `render.yaml` and create both services
5. Configure environment variables as needed

#### Option B: Manual Service Creation

##### Create Backend Service

1. Go to Render Dashboard → "New +" → "Web Service"
2. Select your GitHub repository
3. Configure:
   - **Name**: `tasty-bites-backend`
   - **Environment**: Python
   - **Build Command**:
     ```bash
     pip install -r tastybites/requirements.txt && python tastybites/manage.py collectstatic --noinput && python tastybites/manage.py migrate
     ```
   - **Start Command**:
     ```bash
     gunicorn tastybites.wsgi:application --bind 0.0.0.0:$PORT --workers 2
     ```
   - **Plan**: Free (or paid for production)
4. Add Environment Variables (see below)
5. Deploy

##### Create Frontend Service

1. Go to Render Dashboard → "New +" → "Static Site"
2. Select your GitHub repository
3. Configure:
   - **Name**: `tasty-bites-frontend`
   - **Build Command**: `npm ci && npm run build`
   - **Publish Directory**: `dist`
4. Add Environment Variables:
   - `VITE_API_URL`: Set to your backend URL (e.g., `https://tasty-bites-backend.onrender.com/api`)
5. Deploy

### 3. Environment Variables

#### Backend (Web Service)

Required environment variables to add in Render dashboard:

- **DJANGO_SECRET_KEY**: Generate using `python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"`
- **DJANGO_DEBUG**: `False` (for production)
- **ALLOWED_HOSTS**: `*.onrender.com,localhost`
- **CORS_ALLOWED_ORIGINS**: Your frontend URL (e.g., `https://your-frontend-name.onrender.com`)
- **MPESA_CALLBACK_URL**: `https://your-backend-url.onrender.com/api/payments/callback/`
- **MPESA_ENVIRONMENT**: `sandbox` (or `production`)
- **EMAIL_HOST_USER**: Your Gmail address
- **EMAIL_HOST_PASSWORD**: Your Gmail app password
- **MPESA_ADMIN_TOKEN**: A secure token for admin endpoints

#### Frontend (Static Site)

- **VITE_API_URL**: `https://your-backend-url.onrender.com/api`

### 4. Database

The project currently uses SQLite. For production, consider:

1. **Use Render PostgreSQL** (recommended for production)
   - Add a PostgreSQL database service in Render
   - Update `DATABASES` in `settings.py` to use PostgreSQL
   - Add connection string to environment variables

2. **Keep SQLite** (for free tier/development)
   - Files persist in Render's persistent disk
   - Limited concurrency

### 5. Post-Deployment

After both services are deployed:

1. **Create admin user** (if needed):
   ```bash
   python tastybites/manage.py createsuperuser
   ```

2. **Test the connection**:
   - Visit frontend URL - should load
   - Visit `https://your-backend-url.onrender.com/api/health/` - should return `{"status":"ok"}`

3. **Check logs**:
   - Backend: View logs in Render dashboard under Web Service
   - Frontend: View build logs in Static Site settings

4. **Configure M-Pesa**:
   - Update M-Pesa callback URL in Safaricom dashboard to point to your Render backend
   - Test STK Push with test phone numbers

## Troubleshooting

### 502 Bad Gateway on Backend

- Check backend logs for errors
- Verify environment variables are set
- Run migrations: `python tastybites/manage.py migrate`

### Frontend Cannot Reach Backend

- Verify `VITE_API_URL` environment variable is set correctly
- Check CORS settings in Django (CORS_ALLOWED_ORIGINS)
- Rebuild frontend after changing environment variables

### M-Pesa Callbacks Not Working

- Verify `MPESA_CALLBACK_URL` matches your backend domain
- Check callback endpoint logs: `python tastybites/manage.py tail`
- Ensure callback URL is HTTPS and publicly accessible

## Local Development

### Run Both Services Locally

```bash
# Install dependencies
npm install
pip install -r tastybites/requirements.txt

# Run both services (frontend on :5174, backend on :8000)
npm run dev

# Or separately:
# Terminal 1: Frontend
npm run dev:client

# Terminal 2: Backend  
npm run dev:server
```

### Environment Files

- `.env.development.local`: Local development overrides (git-ignored)
- `.env.production`: Production variable examples
- `render.yaml`: Render-specific deployment config

## File Structure for Deployment

```
tasty-bites-hub/
├── dist/                          # Built frontend (generated)
├── src/                           # Frontend React code
├── tastybites/                    # Django backend
│   ├── manage.py
│   ├── requirements.txt
│   ├── db.sqlite3                 # SQLite database
│   ├── tastybites/
│   │   ├── settings.py
│   │   ├── wsgi.py
│   │   └── urls.py
│   ├── payments/                  # Django app
│   └── staticfiles/               # Collected static files (generated)
├── render.yaml                    # Render blueprint
├── Procfile                       # Process file for Render
├── package.json                   # NPM configuration
├── vite.config.ts                 # Vite configuration
└── DEPLOYMENT.md                  # This file
```

## Monitoring & Maintenance

- **Logs**: Check Render dashboard regularly for errors
- **Auto-redeploy**: Enable in Render settings to deploy on every push to main branch
- **Database Backups**: If using PostgreSQL, enable backups in Render
- **Performance**: Monitor response times and adjust workers if needed

## Next Steps

1. Deploy backend service
2. Deploy frontend service  
3. Configure environment variables
4. Test API connectivity
5. Configure M-Pesa in Safaricom dashboard
6. Monitor logs and adjust settings as needed

For more help: https://render.com/docs
