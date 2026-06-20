# Deployment validation script for Render (PowerShell version)
# Run this before pushing to ensure everything is configured correctly

$ErrorActionPreference = "Stop"

Write-Host "╔════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  TASTY BITES HUB - RENDER DEPLOYMENT VALIDATOR         ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

$ERRORS = 0
$WARNINGS = 0

function Check-File {
  param([string]$Path)
  if (Test-Path $Path) {
    Write-Host "✓ Found: $Path" -ForegroundColor Green
  } else {
    Write-Host "✗ Missing: $Path" -ForegroundColor Red
    $script:ERRORS++
  }
}

function Check-Dir {
  param([string]$Path)
  if (Test-Path $Path -PathType Container) {
    Write-Host "✓ Found: $Path/" -ForegroundColor Green
  } else {
    Write-Host "✗ Missing: $Path/" -ForegroundColor Red
    $script:ERRORS++
  }
}

Write-Host "📋 Checking project structure..."
Check-File "render.yaml"
Check-File "Procfile"
Check-File "RENDER_DEPLOYMENT.md"
Check-File "package.json"
Check-File "tastybites\requirements.txt"
Check-File "tastybites\manage.py"
Check-File "tastybites\tastybites\settings.py"
Check-File "src\lib\api-config.ts"
Check-File ".env.example"
Write-Host ""

Write-Host "🔧 Checking frontend build..."
try {
  $output = npm run build 2>&1
  Write-Host "✓ Frontend builds successfully" -ForegroundColor Green
} catch {
  Write-Host "✗ Frontend build failed" -ForegroundColor Red
  $ERRORS++
}
Write-Host ""

Write-Host "📄 Checking configuration files..."
$settingsContent = Get-Content "tastybites\tastybites\settings.py" -Raw
if ($settingsContent -match "STATIC_ROOT") {
  Write-Host "✓ STATIC_ROOT configured in settings.py" -ForegroundColor Green
} else {
  Write-Host "⚠ STATIC_ROOT not configured (required for production)" -ForegroundColor Yellow
  $WARNINGS++
}

if ($settingsContent -match "whitenoise") {
  Write-Host "✓ WhiteNoise configured in settings.py" -ForegroundColor Green
} else {
  Write-Host "⚠ WhiteNoise not configured (recommended for static files)" -ForegroundColor Yellow
  $WARNINGS++
}
Write-Host ""

$reqContent = Get-Content "tastybites\requirements.txt" -Raw
if ($reqContent -match "gunicorn") {
  Write-Host "✓ Gunicorn in requirements.txt" -ForegroundColor Green
} else {
  Write-Host "✗ Gunicorn not in requirements.txt" -ForegroundColor Red
  $ERRORS++
}

if ($reqContent -match "Django") {
  Write-Host "✓ Django in requirements.txt" -ForegroundColor Green
} else {
  Write-Host "✗ Django not in requirements.txt" -ForegroundColor Red
  $ERRORS++
}
Write-Host ""

Write-Host "🚀 Deployment Checklist:" -ForegroundColor Cyan
Write-Host "   ☐ Push code to GitHub"
Write-Host "   ☐ Create render.yaml blueprint in Render dashboard"
Write-Host "   ☐ Generate and configure environment variables (use generate_secrets.py)"
Write-Host "   ☐ Configure M-Pesa callback URL"
Write-Host "   ☐ Monitor deployment logs"
Write-Host ""

if ($ERRORS -eq 0) {
  Write-Host "✓ All checks passed!" -ForegroundColor Green
  if ($WARNINGS -gt 0) {
    Write-Host "⚠ $WARNINGS warnings - review above" -ForegroundColor Yellow
  } else {
    Write-Host "Ready for Render deployment." -ForegroundColor Green
  }
  exit 0
} else {
  Write-Host "✗ $ERRORS errors found - fix above issues before deployment" -ForegroundColor Red
  exit 1
}
