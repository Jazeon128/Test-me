#!/bin/bash
# Docker Setup Verification Script
# This script verifies that the Docker Compose setup is working correctly

echo "🐳 Test Me - Docker Setup Verification"
echo "========================================"
echo ""

# Check if Docker is installed
echo "1. Checking Docker installation..."
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker Desktop."
    exit 1
fi
echo "✅ Docker is installed"

# Check if Docker Compose is installed
echo ""
echo "2. Checking Docker Compose installation..."
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose."
    exit 1
fi
echo "✅ Docker Compose is installed"

# Check if .env file exists
echo ""
echo "3. Checking .env file..."
if [ ! -f .env ]; then
    echo "⚠️  .env file not found. Creating from .env.example..."
    cp .env.example .env
    echo "✅ Created .env file. Please edit it and add your API keys."
else
    echo "✅ .env file exists"
fi

# Check if required files exist
echo ""
echo "4. Checking required files..."
files=(
    "docker-compose.yml"
    "backend/Dockerfile"
    "frontend/Dockerfile"
    "backend/alembic.ini"
    "backend/alembic/env.py"
)

all_files_exist=true
for file in "${files[@]}"; do
    if [ ! -f "$file" ]; then
        echo "❌ Missing file: $file"
        all_files_exist=false
    fi
done

if [ "$all_files_exist" = true ]; then
    echo "✅ All required files exist"
else
    echo "❌ Some required files are missing"
    exit 1
fi

# Validate docker-compose.yml
echo ""
echo "5. Validating docker-compose.yml..."
if docker-compose config > /dev/null 2>&1; then
    echo "✅ docker-compose.yml is valid"
else
    echo "❌ docker-compose.yml has errors"
    docker-compose config
    exit 1
fi

# Check if ports are available
echo ""
echo "6. Checking if required ports are available..."
ports=(5173 8000 5432)
ports_available=true

for port in "${ports[@]}"; do
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1 || netstat -an | grep -q ":$port.*LISTEN" 2>/dev/null; then
        echo "⚠️  Port $port is already in use"
        ports_available=false
    fi
done

if [ "$ports_available" = true ]; then
    echo "✅ All required ports are available"
else
    echo "⚠️  Some ports are in use. You may need to stop other services or change ports in docker-compose.yml"
fi

echo ""
echo "========================================"
echo "✅ Docker setup verification complete!"
echo ""
echo "Next steps:"
echo "1. Edit .env file and add your API keys"
echo "2. Run: docker-compose up -d"
echo "3. Access frontend at: http://localhost:5173"
echo "4. Access backend at: http://localhost:8000"
echo "5. View API docs at: http://localhost:8000/docs"
echo ""
echo "For more information, see DOCKER.md"
