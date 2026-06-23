# GitHub Secrets Setup for Sevalla Deployment
# This script helps you configure all required GitHub secrets for Sevalla deployment

# Usage:
# 1. Update the variables below with your values
# 2. Run: .\setup-github-secrets.ps1
# 3. Enter your GitHub token when prompted

# ============================================================================
# Configuration
# ============================================================================

$GitHubRepo = "Omollo-George/tasty-bites-hub"  # YOUR_USERNAME/REPO_NAME
$DockerUsername = "omollo001"
$DockerPassword = "YOUR_DOCKER_HUB_PASSWORD"  # Set via secure input
$SevallaApp = "YOUR_SEVALLA_APP_ID"           # From Sevalla dashboard
$SevallaApiUrl = "YOUR_SEVALLA_WEBHOOK_URL"   # From Sevalla settings
$SevallaApiToken = "YOUR_SEVALLA_API_TOKEN"   # From Sevalla settings
$SevallaDomain = "tastybites-w2ip3.sevalla.app"

# ============================================================================
# Secrets to create
# ============================================================================

$Secrets = @{
    "DOCKER_USERNAME"   = $DockerUsername
    "DOCKER_PASSWORD"   = $DockerPassword
    "SEVALLA_APP"       = $SevallaApp
    "SEVALLA_API_URL"   = $SevallaApiUrl
    "SEVALLA_API_TOKEN" = $SevallaApiToken
    "SEVALLA_DOMAIN"    = $SevallaDomain
}

Write-Host "GitHub Secrets Setup for Sevalla Deployment" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Repository: $GitHubRepo" -ForegroundColor Yellow
Write-Host ""

# Instructions
Write-Host "To use this script:" -ForegroundColor Green
Write-Host "1. Go to GitHub: https://github.com/$GitHubRepo/settings/secrets/actions" -ForegroundColor White
Write-Host "2. Click 'New repository secret' for each secret below:" -ForegroundColor White
Write-Host ""

foreach ($key in $Secrets.Keys) {
    $value = $Secrets[$key]
    if ($value -match "^YOUR_") {
        Write-Host "  ❌ $key = $value" -ForegroundColor Red
        Write-Host "     ⚠️  UPDATE THIS VALUE IN THE SCRIPT FIRST" -ForegroundColor Yellow
    } else {
        Write-Host "  ✅ $key = $($value.Substring(0, [Math]::Min(20, $value.Length)))..." -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "Or, use GitHub CLI (if installed):" -ForegroundColor Cyan
Write-Host ""

foreach ($key in $Secrets.Keys) {
    $value = $Secrets[$key]
    if (-not ($value -match "^YOUR_")) {
        Write-Host "gh secret set $key --body `"$value`" --repo $GitHubRepo"
    }
}

Write-Host ""
Write-Host "To find your Sevalla settings:" -ForegroundColor Cyan
Write-Host "  1. Go to https://dashboard.sevalla.app" -ForegroundColor White
Write-Host "  2. Navigate to your app settings" -ForegroundColor White
Write-Host "  3. Find 'Deployment Webhook' section" -ForegroundColor White
Write-Host "  4. Copy URL as SEVALLA_API_URL and token as SEVALLA_API_TOKEN" -ForegroundColor White

