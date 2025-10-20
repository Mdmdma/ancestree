#!/bin/bash

# Test Deployment Script for ancestree.ch
# This script builds the app locally and deploys it to the test server

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
REMOTE_USER="ubuntu"
REMOTE_HOST="ancestree.ch"
REMOTE_PATH="~/ancestree-deploy"
SSH_TARGET="${REMOTE_USER}@${REMOTE_HOST}"

echo -e "${BLUE}🚀 Starting deployment to ${REMOTE_HOST}...${NC}"
echo ""

# Step 1: Build the frontend
echo -e "${YELLOW}📦 Step 1: Building React frontend...${NC}"
cd ../ancestree-app

if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Error: ancestree-app/package.json not found!${NC}"
    exit 1
fi

npm run build

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Frontend build failed!${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Frontend built successfully${NC}"
echo ""

# Step 2: Copy files to remote server
echo -e "${YELLOW}📤 Step 2: Copying files to ${REMOTE_HOST}...${NC}"

# Create deployment directory on remote if it doesn't exist
ssh ${SSH_TARGET} "mkdir -p ${REMOTE_PATH}/dist"

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Failed to connect to remote server!${NC}"
    echo -e "${YELLOW}💡 Make sure you can SSH to ${SSH_TARGET} without password (use ssh-copy-id)${NC}"
    exit 1
fi

# Copy the built frontend
echo -e "${BLUE}  Copying dist folder...${NC}"
rsync -avz --delete dist/ ${SSH_TARGET}:${REMOTE_PATH}/dist/

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Failed to copy dist folder!${NC}"
    exit 1
fi

# Copy backend files (excluding node_modules and databases)
echo -e "${BLUE}  Copying backend files...${NC}"
cd ../ancestree-backend
rsync -avz --delete \
    --exclude 'node_modules' \
    --exclude 'ancestree.db' \
    --exclude 'ancestree_old.db' \
    --exclude '.env' \
    --exclude 'logs/*.log' \
    --exclude 'testdep.sh' \
    ./ ${SSH_TARGET}:${REMOTE_PATH}/

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Failed to copy backend files!${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Files copied successfully${NC}"
echo ""

# Step 3: Install dependencies and restart on remote
echo -e "${YELLOW}🔄 Step 3: Installing dependencies and restarting PM2...${NC}"

ssh ${SSH_TARGET} << 'ENDSSH'
cd ~/ancestree-deploy

# Install/update dependencies
echo "📦 Installing dependencies..."
npm install --production

if [ $? -ne 0 ]; then
    echo "❌ npm install failed!"
    exit 1
fi

# Restart PM2
echo "🔄 Restarting PM2..."
pm2 restart ancestree --env production 2>/dev/null || pm2 start ecosystem.config.json --env production

if [ $? -ne 0 ]; then
    echo "❌ PM2 restart failed!"
    exit 1
fi

# Show status
echo ""
echo "📊 PM2 Status:"
pm2 list

ENDSSH

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Remote commands failed!${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}✅ Deployment completed successfully!${NC}"
echo ""
echo -e "${BLUE}📋 Your app is now running at:${NC}"
echo -e "${GREEN}   http://${REMOTE_HOST}:3001${NC}"
echo ""
echo -e "${YELLOW}💡 Useful commands:${NC}"
echo -e "   View logs:    ssh ${SSH_TARGET} 'pm2 logs ancestree'"
echo -e "   Check status: ssh ${SSH_TARGET} 'pm2 status'"
echo -e "   Restart app:  ssh ${SSH_TARGET} 'pm2 restart ancestree'"
echo ""
