#!/bin/bash
# Fly.io Full Deployment Script for Tasty Bites Hub
# This script automates the entire setup and deployment to Fly.io
# Usage: bash scripts/fly-deploy.sh <app-name> [db-app-name]
# Example: bash scripts/fly-deploy.sh tasty-bites-hub tasty-bites-db

set -e

if [ -z "$1" ]; then
    echo "ERROR: App name required"
    echo "Usage: bash scripts/fly-deploy.sh <app-name> [db-app-name]"
    echo "Example: bash scripts/fly-deploy.sh tasty-bites-hub tasty-bites-db"
    exit 1
fi

APP_NAME="$1"
DB_APP_NAME="${2:-${APP_NAME}-db}"

echo "=========================================="
echo "Fly.io Deployment: $APP_NAME"
echo "=========================================="

# Check if flyctl is installed
if ! command -v fly &> /dev/null; then
    echo "ERROR: flyctl not found. Install from: https://fly.io/docs/hands-on/install/"
    exit 1
fi

# Check if logged in
if ! fly auth whoami &> /dev/null; then
    echo "ERROR: Not logged into Fly. Run: fly auth login"
    exit 1
fi

echo ""
echo "STEP 1: Create Postgres database app"
if fly apps list | grep -q "$DB_APP_NAME"; then
    echo "✓ Database app '$DB_APP_NAME' already exists"
else
    echo "Creating database app '$DB_APP_NAME'..."
    fly postgres create --name "$DB_APP_NAME" --region ord --vm-size shared-cpu-1x --initial-cluster-size 1 --skip-launch || echo "Database may already exist, continuing..."
fi

# Get database connection URL
echo ""
echo "STEP 2: Get database connection string"
DB_URL=$(fly postgres attach --app "$APP_NAME" "$DB_APP_NAME" 2>&1 | grep DATABASE_URL || echo "")
if [ -z "$DB_URL" ]; then
    echo "Fetching DATABASE_URL from Fly..."
    DB_URL=$(fly secrets list --app "$APP_NAME" 2>&1 | grep DATABASE_URL | awk '{print $2}' || echo "")
fi

if [ -z "$DB_URL" ]; then
    echo "WARNING: Could not auto-fetch DATABASE_URL. You will need to set it manually."
    DB_URL="postgres://user:pass@host/dbname?sslmode=require"
fi

echo "DATABASE_URL: ${DB_URL:0:50}..."

# Generate Django secret key
echo ""
echo "STEP 3: Generate Django secret key"
SECRET_KEY=$(python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())" 2>/dev/null || echo "change-me-in-production")
echo "SECRET_KEY generated"

# Get app domain
APP_DOMAIN="${APP_NAME}.fly.dev"

# Set secrets
echo ""
echo "STEP 4: Set app secrets and environment variables"
fly secrets set \
    --app "$APP_NAME" \
    DJANGO_SECRET_KEY="$SECRET_KEY" \
    DATABASE_URL="$DB_URL" \
    DEBUG="False" \
    DJANGO_SETTINGS_MODULE="tastybites.settings" \
    ALLOWED_HOSTS="$APP_DOMAIN" \
    CORS_ALLOWED_ORIGINS="https://$APP_DOMAIN" \
    PGSSLMODE="require" \
    ADMIN_TOKEN="$(openssl rand -hex 16)" \
    PORT="8000"

echo "✓ Secrets set"

# Deploy
echo ""
echo "STEP 5: Deploy app to Fly"
fly deploy --app "$APP_NAME" --remote-only
echo "✓ App deployed"

# Run migrations
echo ""
echo "STEP 6: Run Django migrations"
fly ssh console --app "$APP_NAME" -t << 'EOF'
cd /app
python manage.py migrate --noinput
python manage.py collectstatic --noinput
echo "✓ Migrations and collectstatic complete"
EOF

echo ""
echo "=========================================="
echo "✓ Deployment complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Frontend URL: https://$APP_DOMAIN"
echo "2. API URL: https://$APP_DOMAIN/api"
echo "3. Admin panel: https://$APP_DOMAIN/admin"
echo ""
echo "To view logs: fly logs --app $APP_NAME"
echo "To restart: fly restart --app $APP_NAME"
echo ""
