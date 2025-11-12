#!/bin/bash

# Test deployment script - builds locally and deploys to ancestree.ch
# This script builds the frontend locally and syncs it to the remote server

set -e  # Exit on any error

REMOTE_USER="ubuntu"
REMOTE_HOST="ancestree.ch"
REMOTE_PATH="/home/ubuntu/ancestree/ancestree-app"
LOCAL_BUILD_DIR="ancestree-app/dist"

echo "🚀 Starting local build and remote deployment..."

# Check if we're in the right directory
if [ ! -d "ancestree-app" ]; then
    echo "❌ Error: Please run this script from the ancestree root directory"
    exit 1
fi

# Build the frontend locally
echo "📦 Building React frontend locally..."
cd ancestree-app
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Frontend build failed!"
    exit 1
fi

echo "✅ Frontend built successfully"
cd ..

# Sync the dist folder to remote server
echo "📤 Deploying build to ${REMOTE_HOST}..."
rsync -avz --delete \
    ${LOCAL_BUILD_DIR}/ \
    ${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_PATH}/dist/

if [ $? -ne 0 ]; then
    echo "❌ Deployment failed!"
    exit 1
fi

echo "✅ Build deployed successfully"

# Restart PM2 on remote server
echo "🔄 Restarting PM2 service on remote server..."
ssh ${REMOTE_USER}@${REMOTE_HOST} "cd ${REMOTE_PATH} && pm2 restart ancestree"

if [ $? -ne 0 ]; then
    echo "❌ PM2 restart failed!"
    exit 1
fi

echo "✅ PM2 service restarted successfully"
echo ""
echo "🎉 Deployment complete! Your app should now be live at ${REMOTE_HOST}"
