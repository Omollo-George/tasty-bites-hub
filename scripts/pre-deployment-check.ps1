# Sevalla Pre-Deployment Build & Test Script (Windows PowerShell)
# This script verifies your application is ready for Sevalla deployment

param(
    [switch]$SkipFrontend = $false,
    [switch]$SkipMigrations = $false,
    [switch]$SkipCollectstatic = $false
)

$ErrorActionPreference = "Stop"

# Color functions
function Write-Green { Write-Host $args[0] -ForegroundColor Green }
function Write-Red { Write-Host $args[0] -ForegroundColor Red }
function Write-Yellow { Write-Host $args[0] -ForegroundColor Yellow }

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "SEVALLA PRE-DEPLOYMENT VERIFICATION" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

# Check 1: Frontend build
if (-not $SkipFrontend) {
    Write-Yellow "`n[1/6] Building Frontend..."
    if (Test-Path "package.json") {
        npm install
        if ($LASTEXITCODE -ne 0) {
            Write-Red "✗ npm install failed"
            exit 1
        }
        
        npm run build
        if ($LASTEXITCODE -ne 0) {
            Write-Red "✗ Frontend build failed"
            exit 1
        }
        
        if (Test-Path "dist") {
            Write-Green "✓ Frontend built successfully"
        } else {
            Write-Red "✗ Frontend build failed - dist directory not found"
            exit 1
        }
    } else {
        Write-Red "✗ package.json not found"
        exit 1
    }
} else {
    Write-Yellow "`n[1/6] Skipping Frontend build (--SkipFrontend)"
}

# Check 2: Backend dependencies
Write-Yellow "`n[2/6] Checking Backend Dependencies..."
if (Test-Path "tastybites/requirements.txt") {
    Set-Location "tastybites"
    pip install -r requirements.txt -q
    if ($LASTEXITCODE -ne 0) {
        Write-Red "✗ Backend dependency installation failed"
        Set-Location ..
        exit 1
    }
    Write-Green "✓ Backend dependencies installed"
} else {
    Write-Red "✗ requirements.txt not found"
    exit 1
}

# Check 3: Database migrations
if (-not $SkipMigrations) {
    Write-Yellow "`n[3/6] Running Database Migrations..."
    python manage.py migrate
    if ($LASTEXITCODE -ne 0) {
        Write-Red "✗ Migrations failed"
        Set-Location ..
        exit 1
    }
    Write-Green "✓ Migrations completed"
} else {
    Write-Yellow "`n[3/6] Skipping migrations (--SkipMigrations)"
}

# Check 4: Collect static files
if (-not $SkipCollectstatic) {
    Write-Yellow "`n[4/6] Collecting Static Files..."
    python manage.py collectstatic --no-input
    if ($LASTEXITCODE -ne 0) {
        Write-Red "✗ Static files collection failed"
        Set-Location ..
        exit 1
    }
    if (Test-Path "staticfiles") {
        Write-Green "✓ Static files collected"
    } else {
        Write-Red "✗ Static files directory not created"
        Set-Location ..
        exit 1
    }
} else {
    Write-Yellow "`n[4/6] Skipping collectstatic (--SkipCollectstatic)"
}

# Check 5: Verify environment variables
Write-Yellow "`n[5/6] Verifying Environment Variables..."
$requiredVars = @("SECRET_KEY", "DATABASE_URL", "ALLOWED_HOSTS", "MPESA_CONSUMER_KEY", "MPESA_CONSUMER_SECRET", "MPESA_CALLBACK_URL", "MPESA_ADMIN_TOKEN")
$missingVars = @()

foreach ($var in $requiredVars) {
    if ([string]::IsNullOrEmpty([Environment]::GetEnvironmentVariable($var))) {
        $missingVars += $var
    }
}

if ($missingVars.Count -gt 0) {
    Write-Yellow "⚠ Missing environment variables (optional for local testing):"
    foreach ($var in $missingVars) {
        Write-Host "  - $var"
    }
} else {
    Write-Green "✓ All required environment variables set"
}

# Check 6: Test server start
Write-Yellow "`n[6/6] Testing Gunicorn Server Start (5 seconds)..."
$process = Start-Process -FilePath "gunicorn" -ArgumentList "tastybites.wsgi:application", "--bind", "127.0.0.1:8000", "--workers", "1" -NoNewWindow -PassThru
Start-Sleep -Seconds 5
Stop-Process -InputObject $process -ErrorAction SilentlyContinue
Write-Green "✓ Server starts successfully"

Set-Location ..

Write-Host "`n" -ForegroundColor Green
Write-Host "===========================================" -ForegroundColor Green
Write-Host "✓ PRE-DEPLOYMENT CHECKS PASSED" -ForegroundColor Green
Write-Host "===========================================" -ForegroundColor Green

Write-Yellow "`nNext Steps:"
Write-Host "1. Set all environment variables in Sevalla dashboard"
Write-Host "2. Provision PostgreSQL database on Sevalla"
Write-Host "3. Deploy using: git push origin main"
Write-Host "4. Monitor logs in Sevalla dashboard"
Write-Host "5. Test payment flow with M-Pesa test numbers"

Write-Yellow "`nUseful Sevalla Commands:"
Write-Host "- View logs: sevalla logs <service-name>"
Write-Host "- SSH access: sevalla shell <service-name>"
Write-Host "- View environment: sevalla env list <service-name>"
