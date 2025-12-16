# Docker Setup Verification Script (PowerShell)
# This script verifies that the Docker Compose setup is working correctly

Write-Host "🐳 Test Me - Docker Setup Verification" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$allChecksPass = $true

# Check if Docker is installed
Write-Host "1. Checking Docker installation..." -ForegroundColor Yellow
try {
    $dockerVersion = docker --version 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Docker is installed: $dockerVersion" -ForegroundColor Green
    } else {
        Write-Host "❌ Docker is not installed. Please install Docker Desktop." -ForegroundColor Red
        $allChecksPass = $false
    }
} catch {
    Write-Host "❌ Docker is not installed. Please install Docker Desktop." -ForegroundColor Red
    $allChecksPass = $false
}

# Check if Docker Compose is installed
Write-Host ""
Write-Host "2. Checking Docker Compose installation..." -ForegroundColor Yellow
try {
    $composeVersion = docker-compose --version 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Docker Compose is installed: $composeVersion" -ForegroundColor Green
    } else {
        Write-Host "❌ Docker Compose is not installed. Please install Docker Compose." -ForegroundColor Red
        $allChecksPass = $false
    }
} catch {
    Write-Host "❌ Docker Compose is not installed. Please install Docker Compose." -ForegroundColor Red
    $allChecksPass = $false
}

# Check if .env file exists
Write-Host ""
Write-Host "3. Checking .env file..." -ForegroundColor Yellow
if (-not (Test-Path ".env")) {
    Write-Host "⚠️  .env file not found. Creating from .env.example..." -ForegroundColor Yellow
    Copy-Item ".env.example" ".env"
    Write-Host "✅ Created .env file. Please edit it and add your API keys." -ForegroundColor Green
} else {
    Write-Host "✅ .env file exists" -ForegroundColor Green
}

# Check if required files exist
Write-Host ""
Write-Host "4. Checking required files..." -ForegroundColor Yellow
$files = @(
    "docker-compose.yml",
    "backend/Dockerfile",
    "frontend/Dockerfile",
    "backend/alembic.ini",
    "backend/alembic/env.py"
)

$allFilesExist = $true
foreach ($file in $files) {
    if (-not (Test-Path $file)) {
        Write-Host "❌ Missing file: $file" -ForegroundColor Red
        $allFilesExist = $false
        $allChecksPass = $false
    }
}

if ($allFilesExist) {
    Write-Host "✅ All required files exist" -ForegroundColor Green
}

# Validate docker-compose.yml
Write-Host ""
Write-Host "5. Validating docker-compose.yml..." -ForegroundColor Yellow
try {
    $configOutput = docker-compose config 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ docker-compose.yml is valid" -ForegroundColor Green
    } else {
        Write-Host "❌ docker-compose.yml has errors:" -ForegroundColor Red
        Write-Host $configOutput -ForegroundColor Red
        $allChecksPass = $false
    }
} catch {
    Write-Host "❌ Error validating docker-compose.yml" -ForegroundColor Red
    $allChecksPass = $false
}

# Check if ports are available
Write-Host ""
Write-Host "6. Checking if required ports are available..." -ForegroundColor Yellow
$ports = @(5173, 8000, 5432)
$portsAvailable = $true

foreach ($port in $ports) {
    $connection = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
    if ($connection) {
        Write-Host "⚠️  Port $port is already in use" -ForegroundColor Yellow
        $portsAvailable = $false
    }
}

if ($portsAvailable) {
    Write-Host "✅ All required ports are available" -ForegroundColor Green
} else {
    Write-Host "⚠️  Some ports are in use. You may need to stop other services or change ports in docker-compose.yml" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan

if ($allChecksPass) {
    Write-Host "✅ Docker setup verification complete!" -ForegroundColor Green
} else {
    Write-Host "⚠️  Some checks failed. Please fix the issues above." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Edit .env file and add your API keys"
Write-Host "2. Run: docker-compose up -d"
Write-Host "3. Access frontend at: http://localhost:5173"
Write-Host "4. Access backend at: http://localhost:8000"
Write-Host "5. View API docs at: http://localhost:8000/docs"
Write-Host ""
Write-Host "For more information, see DOCKER.md" -ForegroundColor Cyan
