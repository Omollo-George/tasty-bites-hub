# Tasty Bites Sevalla Deployment Automation Script
# Usage: .\deploy-sevalla.ps1 -DockerUsername YOUR_USERNAME -SevallaApp YOUR_APP_ID -DatabaseUrl "postgresql://..." -SecretsFile "./secrets.env"

param(
    [string]$DockerUsername = "",
    [string]$SevallaApp = "",
    [string]$DatabaseUrl = "",
    [string]$SecretsFile = ""
)

# Colors for output
$Colors = @{
    Green = [System.ConsoleColor]::Green
    Yellow = [System.ConsoleColor]::Yellow
    Red = [System.ConsoleColor]::Red
    Cyan = [System.ConsoleColor]::Cyan
}

function Write-Status {
    param([string]$Message, [string]$Color = "Cyan")
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] $Message" -ForegroundColor $Colors[$Color]
}

function Write-Success {
    param([string]$Message)
    Write-Status $Message "Green"
}

function Write-Error-Custom {
    param([string]$Message)
    Write-Status "ERROR: $Message" "Red"
}

# ============================================================================
# STEP 1: Validate Prerequisites
# ============================================================================

Write-Status "Step 1: Validating prerequisites..." "Cyan"

# Check Docker
try {
    $dockerVersion = docker --version
    Write-Success "Docker found: $dockerVersion"
} catch {
    Write-Error-Custom "Docker not found. Please install Docker Desktop from https://www.docker.com/products/docker-desktop"
    exit 1
}

# Check Docker login
docker ps > $null 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Error-Custom "Docker not authenticated. Run: docker login"
    exit 1
}
Write-Success "Docker authenticated"

# ============================================================================
# STEP 2: Prompt for User Input (if not provided)
# ============================================================================

if (-not $DockerUsername) {
    $DockerUsername = Read-Host "Enter Docker Hub username"
}

if (-not $SevallaApp) {
    $SevallaApp = Read-Host "Enter Sevalla app name (e.g., tasty-bites-abc123)"
}

if (-not $DatabaseUrl) {
    $DatabaseUrl = Read-Host "Enter Sevalla PostgreSQL connection URL"
}

if (-not $Domain) {
    $Domain = Read-Host "Enter your Sevalla domain (e.g., tasty-bites-abc123.sevalla.app)"
}

# Generate or use existing Secret Key
$SecretKey = Read-Host "Enter DJANGO_SECRET_KEY (or press Enter to generate)"
if (-not $SecretKey) {
    Write-Status "Generating SECRET_KEY..."
    $SecretKey = python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
    Write-Success "Generated SECRET_KEY: $SecretKey"
}

# ============================================================================
# STEP 3: Build Docker Image
# ============================================================================

Write-Status "Step 3: Building Docker image..." "Cyan"
Set-Location "c:\Users\omoll\OneDrive\Desktop\tasty-bites-hub"

$commitTag = "latest"
if (Get-Command git -ErrorAction SilentlyContinue) {
    try {
        $commitTag = git rev-parse --short HEAD 2>$null
    } catch {
        Write-Info "Could not determine git commit hash, falling back to latest"
        $commitTag = "latest"
    }
}

$localImage = "tasty-bites:$commitTag"
$remoteImage = "$DockerUsername/tasty-bites-hub:$commitTag"

Write-Status "Building Docker image with VITE_API_URL=https://$Domain..." "Cyan"
docker build --build-arg VITE_API_URL=https://$Domain -t $localImage .
if ($LASTEXITCODE -ne 0) {
    Write-Error-Custom "Docker build failed"
    exit 1
}
Write-Success "Docker image built successfully: $localImage"

# ============================================================================
# STEP 4: Tag Image
# ============================================================================

Write-Status "Step 4: Tagging image for Docker Hub..." "Cyan"
docker tag $localImage $remoteImage
if ($LASTEXITCODE -ne 0) {
    Write-Error-Custom "Failed to tag image"
    exit 1
}
Write-Success "Image tagged as: $remoteImage"

docker tag $localImage "$DockerUsername/tasty-bites-hub:latest" | Out-Null
Write-Success "Also tagged latest as: $DockerUsername/tasty-bites-hub:latest"

# ============================================================================
# STEP 5: Push to Docker Hub
# ============================================================================

Write-Status "Step 5: Pushing image to Docker Hub (this may take 2-10 minutes)..." "Cyan"
docker push $remoteImage
if ($LASTEXITCODE -ne 0) {
    Write-Error-Custom "Failed to push to Docker Hub"
    exit 1
}
Write-Success "Image pushed to Docker Hub successfully: $remoteImage"

docker push "$DockerUsername/tasty-bites-hub:latest" | Out-Null
Write-Success "Also pushed latest tag."

# ============================================================================
# STEP 6: Generate Environment File for Sevalla
# ============================================================================

Write-Status "Step 6: Creating environment configuration..." "Cyan"

$Domain = Read-Host "Enter your Sevalla domain (e.g., tasty-bites-abc123.sevalla.app)"
$AdminToken = Read-Host "Enter ADMIN_TOKEN (or press Enter to generate)"

if (-not $AdminToken) {
    $AdminToken = -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | % {[char]$_})
    Write-Success "Generated ADMIN_TOKEN: $AdminToken"
}

$EnvVars = @"
DJANGO_SECRET_KEY=$SecretKey
DEBUG=False
DJANGO_SETTINGS_MODULE=tastybites.settings
DATABASE_URL=$DatabaseUrl
ALLOWED_HOSTS=$Domain,.sevalla.app
CORS_ALLOWED_ORIGINS=https://$Domain
ADMIN_TOKEN=$AdminToken
PORT=8000
CORS_ALLOW_ALL_ORIGINS=False
"@

$EnvFile = "./sevalla-env.txt"
$EnvVars | Out-File -FilePath $EnvFile -Encoding UTF8
Write-Success "Environment configuration saved to: $EnvFile"

Write-Host ""
Write-Host "========================================" -ForegroundColor Yellow
Write-Host "NEXT STEPS (Manual via Sevalla Dashboard):" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. Go to Sevalla Dashboard:" -ForegroundColor Cyan
Write-Host "   https://sevalla.app/dashboard"
Write-Host ""
Write-Host "2. Select your Web Service: $SevallaApp" -ForegroundColor Cyan
Write-Host ""
Write-Host "3. Go to Deployment Settings and set:" -ForegroundColor Cyan
Write-Host "   - Deployment Source: Container Image"
Write-Host "   - Image URL: $DockerUsername/tasty-bites-hub:latest"
Write-Host ""
Write-Host "4. Add Environment Variables:" -ForegroundColor Cyan
Write-Host "   (Copy each line from below into Sevalla)"
Write-Host ""
$EnvVars | ForEach-Object { Write-Host "   $_" -ForegroundColor Green }
Write-Host ""
Write-Host "5. Click 'Deploy' and wait 2-5 minutes for container to start" -ForegroundColor Cyan
Write-Host ""
Write-Host "6. Once running, open Sevalla Console and run:" -ForegroundColor Cyan
Write-Host "   python manage.py migrate" -ForegroundColor Green
Write-Host "   python manage.py collectstatic --noinput" -ForegroundColor Green
Write-Host ""
Write-Host "7. Test your app:" -ForegroundColor Cyan
Write-Host "   https://$Domain/" -ForegroundColor Green
Write-Host "   https://$Domain/api/health/" -ForegroundColor Green
Write-Host ""
Write-Host "========================================" -ForegroundColor Yellow
Write-Host "Deployment Configuration File: $EnvFile" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Yellow
Write-Host ""
Write-Success "Automation complete! Follow the manual steps above via Sevalla Dashboard."
