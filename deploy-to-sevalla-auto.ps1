<#
Automated deploy script for Tasty Bites -> Sevalla
Usage: Run in repository root (PowerShell).
This script will:
 - Prompt for Docker Hub credentials (secure)
 - Build Docker image `tasty-bites:latest`
 - Tag image as `<docker_user>/tasty-bites:latest`
 - Push to Docker Hub
 - POST deploy request to Sevalla webhook URL

IMPORTANT: Rotate Docker Hub password immediately if you've shared it publicly.
#>

param(
    [string]$DockerUsername = "omollo001",
    [string]$SevallaApp = "tastybites-5bbsd",
    [string]$SevallaHook = "https://hook.sevalla.com/apps/4f7a1e26-e5a1-4a55-92fd-23d12b8b339d/deploy/derufxggpyfh"
)

function Write-Info([string]$m){ Write-Host "[INFO] $m" -ForegroundColor Cyan }
function Write-Success([string]$m){ Write-Host "[OK]   $m" -ForegroundColor Green }
function Write-ErrorMsg([string]$m){ Write-Host "[ERR]  $m" -ForegroundColor Red }

Write-Info "Script starting. Ensure you rotate Docker Hub password if it was exposed."

# Prompt for secrets
$dockerPwdSecure = Read-Host -Prompt "Docker Hub password (input hidden)" -AsSecureString
$sevallaToken = Read-Host -Prompt "Sevalla API token (paste)" -AsSecureString

# Convert secure strings to plain (used only for command invocation)
$unsafe = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($dockerPwdSecure)
$dockerPwd = [Runtime.InteropServices.Marshal]::PtrToStringAuto($unsafe)
[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($unsafe)

$unsafe2 = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($sevallaToken)
$sevTokenPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto($unsafe2)
[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($unsafe2)

# Check Docker presence
try {
    docker --version > $null 2>&1
} catch {
    Write-ErrorMsg "Docker not found on PATH. Install Docker Desktop and try again."
    exit 1
}

# Build image
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
$targetImage = "$DockerUsername/tasty-bites-hub:$commitTag"

Write-Info "Building Docker image '$localImage'..."
$build = docker build -t $localImage .
if ($LASTEXITCODE -ne 0) { Write-ErrorMsg "Docker build failed."; exit 1 }
Write-Success "Docker image built."

# Tag image
Write-Info "Tagging image as $targetImage"
docker tag $localImage $targetImage
if ($LASTEXITCODE -ne 0) { Write-ErrorMsg "Tagging failed."; exit 1 }
Write-Success "Image tagged as $targetImage."

docker tag $localImage "$DockerUsername/tasty-bites-hub:latest" | Out-Null
Write-Success "Also tagged latest as: $DockerUsername/tasty-bites-hub:latest"

# Login to Docker Hub
Write-Info "Logging in to Docker Hub as $DockerUsername"
$loginProc = $dockerPwd | docker login --username $DockerUsername --password-stdin
if ($LASTEXITCODE -ne 0) { Write-ErrorMsg "Docker login failed. Check credentials."; exit 1 }
Write-Success "Docker login succeeded."

# Push image
Write-Info "Pushing image $targetImage to Docker Hub..."
docker push $targetImage
if ($LASTEXITCODE -ne 0) { Write-ErrorMsg "Docker push failed."; exit 1 }
Write-Success "Image pushed to Docker Hub."

docker push "$DockerUsername/tasty-bites-hub:latest" | Out-Null
Write-Success "Also pushed latest tag."

# Trigger Sevalla deploy
Write-Info "Triggering Sevalla deploy via webhook: $SevallaHook"
$body = @{ image = $targetImage; app = $SevallaApp }
try {
    $headers = @{ Authorization = "Bearer $sevTokenPlain"; "Content-Type" = "application/json" }
    $resp = Invoke-RestMethod -Uri $SevallaHook -Method Post -Headers $headers -Body ($body | ConvertTo-Json)
    Write-Success "Sevalla response:"
    Write-Host ($resp | ConvertTo-Json -Depth 4)
} catch {
    Write-ErrorMsg "Sevalla deploy request failed: $($_.Exception.Message)"
    Write-Host "If this is an HTTP error, review Sevalla dashboard logs and webhook URL."
    exit 1
}

Write-Success "Deploy request completed. Check Sevalla dashboard for status and run migrations via Sevalla console."

# Zero-out plaintext variables
$dockerPwd = ""
$sevTokenPlain = ""

exit 0
