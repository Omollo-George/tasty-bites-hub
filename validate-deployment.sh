#!/usr/bin/env bash
# Deployment validation script for Render
# Run this before pushing to ensure everything is configured correctly

set -e

echo "╔════════════════════════════════════════════════════════╗"
echo "║  TASTY BITES HUB - RENDER DEPLOYMENT VALIDATOR         ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""

ERRORS=0
WARNINGS=0

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

check_file() {
  if [ -f "$1" ]; then
    echo -e "${GREEN}✓${NC} Found: $1"
  else
    echo -e "${RED}✗${NC} Missing: $1"
    ERRORS=$((ERRORS + 1))
  fi
}

check_dir() {
  if [ -d "$1" ]; then
    echo -e "${GREEN}✓${NC} Found: $1/"
  else
    echo -e "${RED}✗${NC} Missing: $1/"
    ERRORS=$((ERRORS + 1))
  fi
}

echo "📋 Checking project structure..."
check_file "render.yaml"
check_file "Procfile"
check_file "RENDER_DEPLOYMENT.md"
check_file "package.json"
check_file "tastybites/requirements.txt"
check_file "tastybites/manage.py"
check_file "tastybites/tastybites/settings.py"
check_file "src/lib/api-config.ts"
check_file ".env.example"
echo ""

echo "🔧 Checking frontend build..."
if npm run build > /dev/null 2>&1; then
  echo -e "${GREEN}✓${NC} Frontend builds successfully"
else
  echo -e "${RED}✗${NC} Frontend build failed"
  ERRORS=$((ERRORS + 1))
fi
echo ""

echo "🐍 Checking Python/Django setup..."
if python -c "import django" 2>/dev/null; then
  echo -e "${GREEN}✓${NC} Django is installed"
else
  echo -e "${YELLOW}⚠${NC} Django not installed locally (required on Render)"
  WARNINGS=$((WARNINGS + 1))
fi

if [ -f "tastybites/requirements.txt" ]; then
  if grep -q "Django" tastybites/requirements.txt; then
    echo -e "${GREEN}✓${NC} Django in requirements.txt"
  else
    echo -e "${RED}✗${NC} Django not in requirements.txt"
    ERRORS=$((ERRORS + 1))
  fi
fi

if grep -q "gunicorn" tastybites/requirements.txt; then
  echo -e "${GREEN}✓${NC} Gunicorn in requirements.txt"
else
  echo -e "${RED}✗${NC} Gunicorn not in requirements.txt"
  ERRORS=$((ERRORS + 1))
fi
echo ""

echo "📄 Checking configuration files..."
if grep -q "STATIC_ROOT" tastybites/tastybites/settings.py; then
  echo -e "${GREEN}✓${NC} STATIC_ROOT configured in settings.py"
else
  echo -e "${YELLOW}⚠${NC} STATIC_ROOT not configured (required for production)"
  WARNINGS=$((WARNINGS + 1))
fi

if grep -q "whitenoise" tastybites/tastybites/settings.py; then
  echo -e "${GREEN}✓${NC} WhiteNoise configured in settings.py"
else
  echo -e "${YELLOW}⚠${NC} WhiteNoise not configured (recommended for static files)"
  WARNINGS=$((WARNINGS + 1))
fi
echo ""

echo "🚀 Deployment Checklist:"
echo "   □ Push code to GitHub"
echo "   □ Create render.yaml blueprint in Render dashboard"
echo "   □ Generate and configure environment variables (use generate_secrets.py)"
echo "   □ Configure M-Pesa callback URL"
echo "   □ Monitor deployment logs"
echo ""

if [ $ERRORS -eq 0 ]; then
  echo -e "${GREEN}✓ All checks passed!${NC}"
  if [ $WARNINGS -gt 0 ]; then
    echo -e "${YELLOW}⚠ $WARNINGS warnings - review above${NC}"
    exit 0
  fi
  echo "Ready for Render deployment."
  exit 0
else
  echo -e "${RED}✗ $ERRORS errors found - fix above issues before deployment${NC}"
  exit 1
fi
