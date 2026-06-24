# Start both the Django backend and Vite frontend locally and open the browser.
# Run from the repo root with: .\start-local.ps1

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendDir = Join-Path $repoRoot 'backend\tastybites'
$frontendDir = Join-Path $repoRoot 'frontend'

Write-Host "Starting backend in new PowerShell window: $backendDir"
Start-Process pwsh -ArgumentList "-NoExit", "-Command", "Set-Location '$backendDir'; python manage.py runserver 8000"

Start-Sleep -Seconds 2
Write-Host "Starting frontend in new PowerShell window: $frontendDir"
Start-Process pwsh -ArgumentList "-NoExit", "-Command", "Set-Location '$frontendDir'; npm install; npm run dev -- --host 127.0.0.1 --port 5173 --strictPort"

Start-Sleep -Seconds 4
Write-Host 'Opening browser at http://127.0.0.1:5173'
Start-Process 'http://127.0.0.1:5173'
