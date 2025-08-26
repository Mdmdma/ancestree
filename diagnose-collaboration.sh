#!/bin/bash

# Collaboration Debug Script for AWS Lightsail Deployment
echo "🔍 Ancestree Collaboration Diagnostics"
echo "======================================="

# Check environment variables
echo ""
echo "📋 Environment Configuration:"
if [ -f ".env" ]; then
    echo "✅ .env file found"
    API_URL=$(grep VITE_API_BASE_URL .env | cut -d '=' -f2)
    FRONTEND_URL=$(grep FRONTEND_URL .env | cut -d '=' -f2)
    NODE_ENV=$(grep NODE_ENV .env | cut -d '=' -f2)
    
    echo "   API URL: $API_URL"
    echo "   Frontend URL: $FRONTEND_URL"
    echo "   Environment: $NODE_ENV"
    
    # Extract socket URL
    SOCKET_URL=$(echo $API_URL | sed 's|/api||')
    echo "   Socket.IO URL: $SOCKET_URL"
    
    # Check if URLs match pattern for collaboration
    if [[ "$API_URL" == *"localhost"* ]] && [[ "$NODE_ENV" == "production" ]]; then
        echo "⚠️  WARNING: Using localhost in production!"
    fi
    
    if [[ -z "$FRONTEND_URL" ]]; then
        echo "⚠️  WARNING: FRONTEND_URL not set!"
    fi
    
else
    echo "❌ No .env file found"
    exit 1
fi

# Test API endpoint
echo ""
echo "🔗 Testing API Connection:"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${API_URL}/nodes" 2>/dev/null)
if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ API endpoint responding (HTTP $HTTP_CODE)"
else
    echo "❌ API endpoint failed (HTTP $HTTP_CODE)"
fi

# Test Socket.IO endpoint
echo ""
echo "🔌 Testing Socket.IO Connection:"
SOCKET_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${SOCKET_URL}/socket.io/" 2>/dev/null)
if [ "$SOCKET_CODE" = "400" ] || [ "$SOCKET_CODE" = "200" ]; then
    echo "✅ Socket.IO endpoint responding (HTTP $SOCKET_CODE)"
else
    echo "❌ Socket.IO endpoint failed (HTTP $SOCKET_CODE)"
fi

# Check if server is running
echo ""
echo "🚀 Server Status:"
if pgrep -f "node.*server.js" > /dev/null; then
    echo "✅ Node.js server is running"
    SERVER_PID=$(pgrep -f "node.*server.js")
    echo "   Process ID: $SERVER_PID"
else
    echo "❌ Node.js server not found"
fi

# Check port
echo ""
echo "🔌 Port Status:"
if netstat -tlnp 2>/dev/null | grep ":3001" > /dev/null; then
    echo "✅ Port 3001 is listening"
    netstat -tlnp 2>/dev/null | grep ":3001"
else
    echo "❌ Port 3001 is not listening"
fi

# PM2 status if available
echo ""
echo "📊 PM2 Status:"
if command -v pm2 &> /dev/null; then
    pm2 list | grep ancestree || echo "❌ Ancestree not found in PM2"
else
    echo "ℹ️  PM2 not installed"
fi

echo ""
echo "🎯 Quick Fixes:"
echo "1. If API/Socket.IO tests fail: Check firewall and server status"
echo "2. If using localhost in production: Update VITE_API_BASE_URL to your IP/domain"
echo "3. If FRONTEND_URL missing: Set it to match how users access your app"
echo "4. After changes: Restart with 'pm2 restart ancestree'"
echo ""
echo "📋 Example correct configuration for IP deployment:"
echo "   VITE_API_BASE_URL=http://YOUR_IP:3001/api"
echo "   FRONTEND_URL=http://YOUR_IP:3001"
echo "   NODE_ENV=production"
