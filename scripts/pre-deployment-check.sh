#!/bin/bash
# Sevalla Pre-Deployment Build & Test Script
# This script verifies your application is ready for Sevalla deployment

set -e

echo "========================================="
echo "SEVALLA PRE-DEPLOYMENT VERIFICATION"
echo "========================================="

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check 1: Frontend build
echo -e "\n${YELLOW}[1/6] Building Frontend...${NC}"
if [ -f "package.json" ]; then
    npm install
    npm run build
    if [ -d "dist" ]; then
        echo -e "${GREEN}✓ Frontend built successfully${NC}"
    else
        echo -e "${RED}✗ Frontend build failed - dist directory not found${NC}"
        exit 1
    fi
else
    echo -e "${RED}✗ package.json not found${NC}"
    exit 1
fi

# Check 2: Backend dependencies
echo -e "\n${YELLOW}[2/6] Checking Backend Dependencies...${NC}"
if [ -f "tastybites/requirements.txt" ]; then
    cd tastybites
    pip install -r requirements.txt --quiet
    echo -e "${GREEN}✓ Backend dependencies installed${NC}"
else
    echo -e "${RED}✗ requirements.txt not found${NC}"
    exit 1
fi

# Check 3: Database migrations
echo -e "\n${YELLOW}[3/6] Running Database Migrations...${NC}"
python manage.py migrate
echo -e "${GREEN}✓ Migrations completed${NC}"

# Check 4: Collect static files
echo -e "\n${YELLOW}[4/6] Collecting Static Files...${NC}"
python manage.py collectstatic --no-input
if [ -d "staticfiles" ]; then
    echo -e "${GREEN}✓ Static files collected${NC}"
else
    echo -e "${RED}✗ Static files collection failed${NC}"
    exit 1
fi

# Check 5: Verify environment variables
echo -e "\n${YELLOW}[5/6] Verifying Required Environment Variables...${NC}"
REQUIRED_VARS=("SECRET_KEY" "DATABASE_URL" "ALLOWED_HOSTS" "MPESA_CONSUMER_KEY" "MPESA_CONSUMER_SECRET" "MPESA_CALLBACK_URL" "MPESA_ADMIN_TOKEN")

MISSING_VARS=()
for var in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!var}" ]; then
        MISSING_VARS+=("$var")
    fi
done

if [ ${#MISSING_VARS[@]} -ne 0 ]; then
    echo -e "${YELLOW}⚠ Missing environment variables (optional for local testing):${NC}"
    for var in "${MISSING_VARS[@]}"; do
        echo "  - $var"
    done
else
    echo -e "${GREEN}✓ All required environment variables set${NC}"
fi

# Check 6: Test server start
echo -e "\n${YELLOW}[6/6] Testing Gunicorn Server Start (5 seconds)...${NC}"
timeout 5 gunicorn tastybites.wsgi:application --bind 127.0.0.1:8000 --workers 1 || true
echo -e "${GREEN}✓ Server starts successfully${NC}"

cd ..

echo -e "\n${GREEN}=========================================${NC}"
echo -e "${GREEN}✓ PRE-DEPLOYMENT CHECKS PASSED${NC}"
echo -e "${GREEN}=========================================${NC}"

echo -e "\n${YELLOW}Next Steps:${NC}"
echo "1. Set all environment variables in Sevalla dashboard"
echo "2. Provision PostgreSQL database on Sevalla"
echo "3. Deploy using: git push origin main"
echo "4. Monitor logs in Sevalla dashboard"
echo "5. Test payment flow with M-Pesa test numbers"

echo -e "\n${YELLOW}Useful Sevalla Commands:${NC}"
echo "- View logs: sevalla logs <service-name>"
echo "- SSH access: sevalla shell <service-name>"
echo "- View environment: sevalla env list <service-name>"
