#!/bin/bash
# Workflow Validation Script
# This script validates the desktop-app-build.yml workflow file

set -e

echo "=================================="
echo "Workflow Validation Script"
echo "=================================="
echo ""

# Check if workflow file exists
WORKFLOW_FILE=".github/workflows/desktop-app-build.yml"
if [ ! -f "$WORKFLOW_FILE" ]; then
    echo "❌ Error: Workflow file not found: $WORKFLOW_FILE"
    exit 1
fi
echo "✅ Workflow file exists"

# Check if yamllint is installed
if command -v yamllint &> /dev/null; then
    echo "Running yamllint..."
    if yamllint "$WORKFLOW_FILE"; then
        echo "✅ YAML syntax is valid"
    else
        echo "❌ YAML syntax errors found"
        exit 1
    fi
else
    echo "⚠️  yamllint not installed, skipping YAML validation"
    echo "   Install with: pip install yamllint"
fi

# Check for required jobs
echo ""
echo "Checking required jobs..."
REQUIRED_JOBS=(
    "test-electron"
    "test-frontend"
    "test-backend"
    "build-backend"
    "build-frontend"
    "package-windows"
    "package-macos"
    "package-linux"
    "release"
)

for job in "${REQUIRED_JOBS[@]}"; do
    if grep -q "^  $job:" "$WORKFLOW_FILE"; then
        echo "  ✅ Job found: $job"
    else
        echo "  ❌ Job missing: $job"
        exit 1
    fi
done

# Check for required triggers
echo ""
echo "Checking triggers..."
if grep -q "push:" "$WORKFLOW_FILE" && \
   grep -q "pull_request:" "$WORKFLOW_FILE" && \
   grep -q "workflow_dispatch:" "$WORKFLOW_FILE"; then
    echo "✅ All triggers configured"
else
    echo "❌ Missing triggers"
    exit 1
fi

# Check for version tag trigger
if grep -q "tags:" "$WORKFLOW_FILE" && grep -q "'v\*'" "$WORKFLOW_FILE"; then
    echo "✅ Version tag trigger configured"
else
    echo "❌ Version tag trigger missing"
    exit 1
fi

# Check for artifact uploads
echo ""
echo "Checking artifact uploads..."
ARTIFACT_COUNT=$(grep -c "uses: actions/upload-artifact@v4" "$WORKFLOW_FILE" || true)
if [ "$ARTIFACT_COUNT" -ge 8 ]; then
    echo "✅ Artifact uploads configured ($ARTIFACT_COUNT found)"
else
    echo "❌ Insufficient artifact uploads ($ARTIFACT_COUNT found, expected >= 8)"
    exit 1
fi

# Check for release job condition
echo ""
echo "Checking release job..."
if grep -A 5 "^  release:" "$WORKFLOW_FILE" | grep -q "startsWith(github.ref, 'refs/tags/v')"; then
    echo "✅ Release job has correct condition"
else
    echo "❌ Release job condition missing or incorrect"
    exit 1
fi

# Check for matrix strategy in backend build
echo ""
echo "Checking matrix strategy..."
if grep -A 10 "^  build-backend:" "$WORKFLOW_FILE" | grep -q "strategy:"; then
    echo "✅ Matrix strategy configured for backend builds"
else
    echo "❌ Matrix strategy missing for backend builds"
    exit 1
fi

# Check for caching
echo ""
echo "Checking dependency caching..."
CACHE_COUNT=$(grep -c "cache:" "$WORKFLOW_FILE" || true)
if [ "$CACHE_COUNT" -ge 3 ]; then
    echo "✅ Dependency caching configured ($CACHE_COUNT instances)"
else
    echo "⚠️  Limited caching configured ($CACHE_COUNT instances)"
fi

# Summary
echo ""
echo "=================================="
echo "Validation Summary"
echo "=================================="
echo "✅ Workflow file is valid"
echo "✅ All required jobs are present"
echo "✅ Triggers are configured correctly"
echo "✅ Artifact uploads are configured"
echo "✅ Release automation is configured"
echo "✅ Matrix builds are configured"
echo ""
echo "The workflow is ready to use!"
echo ""
echo "Next steps:"
echo "1. Test the workflow on a test repository"
echo "2. Push to main/develop to trigger a build"
echo "3. Create a version tag (v1.0.0) to test release"
echo ""
