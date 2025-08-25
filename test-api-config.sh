#!/bin/bash

# Test script to verify VITE_API_BASE_URL configuration
echo "🧪 Testing VITE_API_BASE_URL configuration..."

# Read the current configuration
if [ -f ".env" ]; then
    API_URL=$(grep VITE_API_BASE_URL .env | cut -d '=' -f2)
    echo "📋 Current VITE_API_BASE_URL: $API_URL"
    
    # Extract socket URL (remove /api)
    SOCKET_URL=$(echo $API_URL | sed 's|/api||')
    echo "🔌 Socket.IO will connect to: $SOCKET_URL"
    
    # Test API endpoint
    echo ""
    echo "🔗 Testing API endpoint..."
    curl -s -o /dev/null -w "Status: %{http_code}\n" "${API_URL}/nodes" || echo "❌ API test failed"
    
    # Test Socket.IO endpoint
    echo "🔗 Testing Socket.IO endpoint..."
    curl -s -o /dev/null -w "Status: %{http_code}\n" "${SOCKET_URL}/socket.io/" || echo "❌ Socket.IO test failed"
    
else
    echo "❌ No .env file found"
fi
