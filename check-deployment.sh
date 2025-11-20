#!/bin/bash

# Deployment Configuration Checker for Ancestree
# This script verifies that all required configuration is in place

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔍 Ancestree Deployment Configuration Checker"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

ERRORS=0
WARNINGS=0

# Check if .env file exists
if [ ! -f .env ]; then
    echo "❌ CRITICAL: .env file not found!"
    echo "   Run: cp .env.example .env"
    echo ""
    ERRORS=$((ERRORS + 1))
    exit 1
fi

echo "✓ .env file found"
echo ""

# Function to check environment variable
check_env_var() {
    local var_name=$1
    local is_required=$2
    local placeholder_pattern=$3
    
    # Check if variable exists
    if ! grep -q "^${var_name}=" .env; then
        if [ "$is_required" = "required" ]; then
            echo "❌ MISSING: $var_name is not defined in .env"
            ERRORS=$((ERRORS + 1))
        else
            echo "⚠️  OPTIONAL: $var_name is not defined (may cause issues)"
            WARNINGS=$((WARNINGS + 1))
        fi
        return
    fi
    
    # Get the value
    local value=$(grep "^${var_name}=" .env | cut -d'=' -f2-)
    
    # Check if value is empty
    if [ -z "$value" ]; then
        echo "❌ EMPTY: $var_name has no value"
        ERRORS=$((ERRORS + 1))
        return
    fi
    
    # Check if value is a placeholder
    if [ -n "$placeholder_pattern" ]; then
        if echo "$value" | grep -qi "$placeholder_pattern"; then
            echo "❌ PLACEHOLDER: $var_name contains placeholder value: $value"
            echo "   Replace with actual value!"
            ERRORS=$((ERRORS + 1))
            return
        fi
    fi
    
    # Value looks good
    echo "✓ $var_name is configured"
}

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Checking AWS S3 Configuration (required for image uploads)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
check_env_var "AWS_ACCESS_KEY_ID" "required" "your_"
check_env_var "AWS_SECRET_ACCESS_KEY" "required" "your_"
check_env_var "AWS_REGION" "required" ""
check_env_var "S3_BUCKET_NAME" "required" "your-"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Checking Google Maps Configuration (required for map features)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
check_env_var "GOOGLE_MAPS_API_KEY" "required" "your_"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Checking Security Configuration"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
check_env_var "JWT_SECRET" "required" "change-this"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Checking Server Configuration"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
check_env_var "NODE_ENV" "optional" ""
check_env_var "PORT" "optional" ""
check_env_var "FRONTEND_URL" "optional" ""
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo "✅ All checks passed! Your configuration looks good."
    echo ""
    echo "Next steps:"
    echo "  1. Start the server: pm2 start ecosystem.config.json --env production"
    echo "  2. Save PM2 config: pm2 save"
    echo "  3. Test upload: Visit your site and try uploading an image"
    exit 0
else
    echo "Found $ERRORS error(s) and $WARNINGS warning(s)"
    echo ""
    
    if [ $ERRORS -gt 0 ]; then
        echo "❌ CRITICAL ERRORS FOUND!"
        echo "   Fix all errors before starting the server."
        echo ""
        echo "To fix:"
        echo "  1. Edit .env file: nano .env"
        echo "  2. Replace all placeholder values with actual values"
        echo "  3. Run this script again to verify: ./check-deployment.sh"
        echo ""
        echo "For help, see: TROUBLESHOOTING.md"
        exit 1
    fi
    
    if [ $WARNINGS -gt 0 ]; then
        echo "⚠️  WARNINGS FOUND"
        echo "   The server may start, but some features might not work."
        echo "   Consider fixing warnings before deploying to production."
        exit 2
    fi
fi
