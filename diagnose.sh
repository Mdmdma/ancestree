#!/bin/bash

# Quick diagnostic script for Ancestree deployment issues
# Run this on the server to collect diagnostic information

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔍 Ancestree Deployment Diagnostics"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Collecting diagnostic information..."
echo ""

# Check PM2 status
echo "━━━ PM2 Process Status ━━━"
if command -v pm2 &> /dev/null; then
    pm2 status
else
    echo "⚠️  PM2 not installed"
fi
echo ""

# Check .env file
echo "━━━ Environment File Check ━━━"
if [ -f .env ]; then
    echo "✓ .env file exists"
    echo ""
    echo "Environment variables (sensitive values hidden):"
    grep -v "^#" .env | grep -v "^$" | while read line; do
        key=$(echo $line | cut -d'=' -f1)
        value=$(echo $line | cut -d'=' -f2-)
        
        # Hide sensitive values
        if [[ $key == *"SECRET"* ]] || [[ $key == *"PASSWORD"* ]] || [[ $key == *"KEY"* ]]; then
            echo "  $key=***HIDDEN***"
        else
            echo "  $key=$value"
        fi
    done
    
    echo ""
    echo "Checking for placeholders:"
    if grep -q "your_" .env || grep -q "change-this" .env; then
        echo "❌ Found placeholder values! These must be replaced:"
        grep -E "(your_|change-this)" .env | sed 's/^/  /'
    else
        echo "✓ No obvious placeholders found"
    fi
else
    echo "❌ .env file not found!"
    echo "   Create it: cp .env.example .env"
fi
echo ""

# Check required environment variables
echo "━━━ Required Configuration Check ━━━"
source .env 2>/dev/null

check_var() {
    local var_name=$1
    local var_value="${!var_name}"
    
    if [ -z "$var_value" ]; then
        echo "❌ $var_name: NOT SET"
    else
        echo "✓ $var_name: configured"
    fi
}

check_var "AWS_ACCESS_KEY_ID"
check_var "AWS_SECRET_ACCESS_KEY"
check_var "AWS_REGION"
check_var "S3_BUCKET_NAME"
check_var "GOOGLE_MAPS_API_KEY"
check_var "JWT_SECRET"
echo ""

# Check server logs
echo "━━━ Recent Server Logs (last 30 lines) ━━━"
if command -v pm2 &> /dev/null; then
    pm2 logs --lines 30 --nostream 2>&1 | tail -30
else
    echo "PM2 not available, checking system logs..."
    if [ -f logs/combined.log ]; then
        tail -30 logs/combined.log
    else
        echo "No logs found"
    fi
fi
echo ""

# Check network/port
echo "━━━ Network Check ━━━"
if command -v netstat &> /dev/null; then
    if netstat -tlnp 2>/dev/null | grep -q ":3001"; then
        echo "✓ Port 3001 is in use (server is running)"
        netstat -tlnp 2>/dev/null | grep ":3001"
    else
        echo "❌ Port 3001 is not in use (server may not be running)"
    fi
else
    echo "⚠️  netstat not available"
fi
echo ""

# Check database
echo "━━━ Database Check ━━━"
if [ -d databases ]; then
    echo "✓ databases/ folder exists"
    echo "Database files:"
    ls -lh databases/*.db 2>/dev/null || echo "  No database files found"
else
    echo "⚠️  databases/ folder not found"
fi
echo ""

# Test API endpoint
echo "━━━ API Health Check ━━━"
if command -v curl &> /dev/null; then
    response=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/health 2>/dev/null)
    if [ "$response" = "200" ]; then
        echo "✓ API is responding (HTTP $response)"
    else
        echo "❌ API not responding correctly (HTTP $response)"
    fi
else
    echo "⚠️  curl not available for testing"
fi
echo ""

# Firewall check
echo "━━━ Firewall Status ━━━"
if command -v ufw &> /dev/null; then
    sudo ufw status | grep "3001" || echo "⚠️  Port 3001 not explicitly allowed in firewall"
else
    echo "⚠️  ufw not available"
fi
echo ""

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 Quick Actions"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "If you see issues above, try these commands:"
echo ""
echo "1. Check detailed configuration:"
echo "   ./check-deployment.sh"
echo ""
echo "2. Edit environment file:"
echo "   nano .env"
echo ""
echo "3. Restart server:"
echo "   pm2 restart all"
echo ""
echo "4. View live logs:"
echo "   pm2 logs"
echo ""
echo "5. For more help, see:"
echo "   - TROUBLESHOOTING.md"
echo "   - IMAGE_UPLOAD_FIX_SUMMARY.md"
echo ""
