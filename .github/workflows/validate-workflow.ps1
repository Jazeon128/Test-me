# Workflow Validation Script (PowerShell)
# This script validates the desktop-app-build.yml workflow file

$ErrorActionPreference = "Stop"

Write-Host "==================================" -ForegroundColor Cyan
Write-Host "Workflow Validation Script" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""

# Check if workflow file exists
$workflowFile = ".github/workflows/desktop-app-build.yml"
if (-not (Test-Path $workflowFile)) {
    Write-Host "❌ Error: Workflow file not found: $workflowFile" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Workflow file exists" -ForegroundColor Green

# Read workflow content
$content = Get-Content $workflowFile -Raw

# Check for required jobs
Write-Host ""
Write-Host "Checking required jobs..." -ForegroundColor Yellow
$requiredJobs = @(
    "test-electron",
    "test-frontend",
    "test-backend",
    "build-backend",
    "build-frontend",
    "package-windows",
    "package-macos",
    "package-linux",
    "release"
)

$allJobsFound = $true
foreach ($job in $requiredJobs) {
    $pattern = "  $job`:"
    if ($content -match [regex]::Escape($pattern)) {
        Write-Host "  ✅ Job found: $job" -ForegroundColor Green
    } else {
        Write-Host "  ❌ Job missing: $job" -ForegroundColor Red
        $allJobsFound = $false
    }
}

if (-not $allJobsFound) {
    exit 1
}

# Check for required triggers
Write-Host ""
Write-Host "Checking triggers..." -ForegroundColor Yellow
$hasPush = $content -match "push:"
$hasPR = $content -match "pull_request:"
$hasManual = $content -match "workflow_dispatch:"

if ($hasPush -and $hasPR -and $hasManual) {
    Write-Host "✅ All triggers configured" -ForegroundColor Green
} else {
    Write-Host "❌ Missing triggers" -ForegroundColor Red
    exit 1
}

# Check for version tag trigger
if ($content -match "tags:" -and $content -match "'v\*'") {
    Write-Host "✅ Version tag trigger configured" -ForegroundColor Green
} else {
    Write-Host "❌ Version tag trigger missing" -ForegroundColor Red
    exit 1
}

# Check for artifact uploads
Write-Host ""
Write-Host "Checking artifact uploads..." -ForegroundColor Yellow
$artifactMatches = [regex]::Matches($content, "uses: actions/upload-artifact@v4")
$artifactCount = $artifactMatches.Count

if ($artifactCount -ge 8) {
    Write-Host "✅ Artifact uploads configured ($artifactCount found)" -ForegroundColor Green
} else {
    Write-Host "❌ Insufficient artifact uploads ($artifactCount found, expected >= 8)" -ForegroundColor Red
    exit 1
}

# Check for release job condition
Write-Host ""
Write-Host "Checking release job..." -ForegroundColor Yellow
if ($content -match "startsWith\(github\.ref, 'refs/tags/v'\)") {
    Write-Host "✅ Release job has correct condition" -ForegroundColor Green
} else {
    Write-Host "❌ Release job condition missing or incorrect" -ForegroundColor Red
    exit 1
}

# Check for matrix strategy
Write-Host ""
Write-Host "Checking matrix strategy..." -ForegroundColor Yellow
if ($content -match "build-backend:[\s\S]*?strategy:") {
    Write-Host "✅ Matrix strategy configured for backend builds" -ForegroundColor Green
} else {
    Write-Host "❌ Matrix strategy missing for backend builds" -ForegroundColor Red
    exit 1
}

# Check for caching
Write-Host ""
Write-Host "Checking dependency caching..." -ForegroundColor Yellow
$cacheMatches = [regex]::Matches($content, "cache:")
$cacheCount = $cacheMatches.Count

if ($cacheCount -ge 3) {
    Write-Host "✅ Dependency caching configured ($cacheCount instances)" -ForegroundColor Green
} else {
    Write-Host "⚠️  Limited caching configured ($cacheCount instances)" -ForegroundColor Yellow
}

# Summary
Write-Host ""
Write-Host "==================================" -ForegroundColor Cyan
Write-Host "Validation Summary" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host "✅ Workflow file is valid" -ForegroundColor Green
Write-Host "✅ All required jobs are present" -ForegroundColor Green
Write-Host "✅ Triggers are configured correctly" -ForegroundColor Green
Write-Host "✅ Artifact uploads are configured" -ForegroundColor Green
Write-Host "✅ Release automation is configured" -ForegroundColor Green
Write-Host "✅ Matrix builds are configured" -ForegroundColor Green
Write-Host ""
Write-Host "The workflow is ready to use!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Test the workflow on a test repository"
Write-Host "2. Push to main/develop to trigger a build"
Write-Host "3. Create a version tag (v1.0.0) to test release"
Write-Host ""
