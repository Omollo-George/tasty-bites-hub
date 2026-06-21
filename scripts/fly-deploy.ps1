# Fly.io Full Deployment Script for Tasty Bites Hub (PowerShell)
# Usage: .\scripts\fly-deploy.ps1 -AppName "tasty-bites-hub" [-DbAppName "tasty-bites-db"]

param(
    [string]$AppName = "",
    [string]$DbAppName = ""
)

function Write-Status {
    param([string]$Message)
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] $Message" -ForegroundColor Cyan
}

function Write-Success {
    param([string]$Message)
    Write-Host "✓ $Message" -ForegroundColor Green
}

function Write-Error-Custom {
    param([string]$Message)
    Write-Host "ERROR: $Message" -ForegroundColor Red
}

# Validate inputs
if (-not $AppName) {
    Write-Error-Custom "App name required"
    Write-Host "Usage: .\scripts\fly-deploy.ps1 -AppName 'tasty-bites-hub' [-DbAppName 'tasty-bites-db']"
    exit 1
}

if (-not $DbAppName) {
    $DbAppName = "$AppName-db"
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Yellow
Write-Host "Fly.io Deployment: $AppName" -ForegroundColor Yellow
Write-Host "==========================================" -ForegroundColor Yellow
Write-Host ""

# Check if flyctl is installed
Write-Status "Checking flyctl installation..."
try {
    $flyVersion = fly --version
    Write-Success "flyctl found: $flyVersion"
} catch {
    Write-Error-Custom "flyctl not found. Install from: https://fly.io/docs/hands-on/install/"
    exit 1
}

# Check if logged in
Write-Status "Checking Fly authentication..."
try {
    $authStatus = fly auth whoami 2>&1
    Write-Success "Logged in as: $authStatus"
} catch {
    Write-Error-Custom "Not logged into Fly. Run: fly auth login"
    exit 1
}

# STEP 1: Create Fly app if needed
Write-Host ""
Write-Status "STEP 1: Create Fly app"
$appExists = fly apps list 2>&1 | Select-String $AppName
if ($appExists) {
    Write-Success "App '$AppName' already exists"
} else {
    Write-Status "Creating app '$AppName'..."
    fly apps create $AppName
    Write-Success "App created"
}

# STEP 2: Create Postgres database
Write-Host ""
Write-Status "STEP 2: Create Postgres database"
$dbExists = fly apps list 2>&1 | Select-String $DbAppName
if ($dbExists) {
    Write-Success "Database app '$DbAppName' already exists"
} else {
    Write-Status "Creating database app '$DbAppName'..."
    fly postgres create --name $DbAppName --region ord --vm-size shared-cpu-1x --initial-cluster-size 1 --skip-launch
    Write-Success "Database app created"
}

# STEP 3: Attach database to app
Write-Host ""
Write-Status "STEP 3: Attach database to app"
Write-Status "This may take a few minutes..."
try {
    $attachOutput = fly postgres attach --app $AppName $DbAppName 2>&1
    Write-Success "Database attached"
} catch {
    Write-Status "Database may already be attached, continuing..."
}

# STEP 4: Generate secrets
Write-Host ""
Write-Status "STEP 4: Generate secrets"

# Django secret key
Write-Status "Generating Django SECRET_KEY..."
$SecretKey = python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
Write-Success "SECRET_KEY generated"

# Admin token
Write-Status "Generating ADMIN_TOKEN..."
$AdminToken = -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | ForEach-Object { [char]$_ })
Write-Success "ADMIN_TOKEN generated"

# App domain
$AppDomain = "$AppName.fly.dev"
Write-Status "App domain: https://$AppDomain"

# STEP 5: Set secrets
Write-Host ""
Write-Status "STEP 5: Set app secrets and environment variables"

$secrets = @(
    "DJANGO_SECRET_KEY=$SecretKey",
    "DEBUG=False",
    "DJANGO_SETTINGS_MODULE=tastybites.settings",
    "ALLOWED_HOSTS=$AppDomain",
    "CORS_ALLOWED_ORIGINS=https://$AppDomain",
    "PGSSLMODE=require",
    "ADMIN_TOKEN=$AdminToken",
    "PORT=8000"
)

foreach ($secret in $secrets) {
    $key, $value = $secret -split "=", 2
    Write-Status "Setting $key..."
    fly secrets set --app $AppName $key="$value" 2>&1 | Out-Null
}

Write-Success "All secrets set"

# STEP 6: Deploy
Write-Host ""
Write-Status "STEP 6: Deploy app to Fly"
fly deploy --app $AppName --remote-only
Write-Success "App deployed"

# STEP 7: Run migrations
Write-Host ""
Write-Status "STEP 7: Run Django migrations and collectstatic"
@"
cd /app
python manage.py migrate --noinput
python manage.py collectstatic --noinput
echo "Done"
"@ | fly ssh console --app $AppName -t
Write-Success "Migrations and static files complete"

Write-Host ""
Write-Host "==========================================" -ForegroundColor Green
Write-Host "✓ Deployment Complete!" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  Frontend: https://$AppDomain"
Write-Host "  API: https://$AppDomain/api"
Write-Host "  Admin: https://$AppDomain/admin"
Write-Host ""
Write-Host "Useful commands:" -ForegroundColor Yellow
Write-Host "  View logs: fly logs --app $AppName"
Write-Host "  Restart app: fly restart --app $AppName"
Write-Host "  SSH into app: fly ssh console --app $AppName"
Write-Host ""
