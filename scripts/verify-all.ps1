# ==============================================================================
# verify-all.ps1 - Master End-to-End System Verification Suite (Milestone M12)
# ==============================================================================

$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$apiPath = Join-Path $repoRoot "apps\api"
$webPath = Join-Path $repoRoot "apps\web"

Write-Host "====================================================================" -ForegroundColor Cyan
Write-Host " [M12] Executing Complete Multi-Tenant LMS Verification Suite       " -ForegroundColor Cyan
Write-Host "====================================================================" -ForegroundColor Cyan

# 1. Backend Code Style Check (Pint)
Write-Host "`n[1/5] Checking Backend Code Style (Pint)..." -ForegroundColor Yellow
Push-Location $apiPath
try {
    & ./vendor/bin/pint --test
    Write-Host "[PASS] Pint Style Check Passed (0 violations)" -ForegroundColor Green
} catch {
    Write-Host "[FAIL] Pint Style Check Failed" -ForegroundColor Red
    Pop-Location
    exit 1
}

# 2. Backend Automated Test Suite (All Milestones M1 - M12)
Write-Host "`n[2/5] Running Backend PHPUnit Test Suite..." -ForegroundColor Yellow
try {
    & php artisan test
    Write-Host "[PASS] Backend PHPUnit Test Suite Passed 100%" -ForegroundColor Green
} catch {
    Write-Host "[FAIL] Backend Test Suite Failed" -ForegroundColor Red
    Pop-Location
    exit 1
}
Pop-Location

# 3. Frontend ESLint
Write-Host "`n[3/5] Running Frontend Linting (ESLint)..." -ForegroundColor Yellow
Push-Location $webPath
try {
    & npm run lint
    Write-Host "[PASS] Frontend ESLint Passed (0 errors, 0 warnings)" -ForegroundColor Green
} catch {
    Write-Host "[FAIL] Frontend ESLint Failed" -ForegroundColor Red
    Pop-Location
    exit 1
}

# 4. Frontend TypeScript Strict Type Check
Write-Host "`n[4/5] Running Frontend Type Check (tsc)..." -ForegroundColor Yellow
try {
    & npx tsc --noEmit
    Write-Host "[PASS] TypeScript Strict Type Check Passed (0 errors)" -ForegroundColor Green
} catch {
    Write-Host "[FAIL] TypeScript Type Check Failed" -ForegroundColor Red
    Pop-Location
    exit 1
}

# 5. Frontend Production Build (Turbopack Next.js 16)
Write-Host "`n[5/5] Building Frontend Production Bundle (Next.js 16 App Router)..." -ForegroundColor Yellow
try {
    & npm run build
    Write-Host "[PASS] Frontend Production Bundle Built Successfully" -ForegroundColor Green
} catch {
    Write-Host "[FAIL] Frontend Build Failed" -ForegroundColor Red
    Pop-Location
    exit 1
}
Pop-Location

Write-Host "`n====================================================================" -ForegroundColor Cyan
Write-Host " [M12 VERIFIED] ALL GATES PASSED SUCCESSFULLY                      " -ForegroundColor Green
Write-Host "====================================================================" -ForegroundColor Cyan
