#!/bin/bash

# Build script for AWS Lightsail deployment
echo "🚀 Building Ancestree for production deployment..."

# Check if we're in the right directory
if [ ! -d "ancestree-app" ] || [ ! -d "ancestree-backend" ]; then
    echo "❌ Error: Please run this script from the ancestree root directory"
    exit 1
fi

# Build the frontend
echo "📦 Building React frontend..."
cd ancestree-app
npm install
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Frontend build failed!"
    exit 1
fi

echo "✅ Frontend built successfully"

# Install backend dependencies
echo "📦 Installing backend dependencies..."
cd ../ancestree-backend
npm install

if [ $? -ne 0 ]; then
    echo "❌ Backend dependency installation failed!"
    exit 1
fi

echo "✅ Backend dependencies installed"

# Create production package
echo "📦 Creating deployment package..."
cd ..
rm -rf ancestree-deploy
mkdir ancestree-deploy

# Copy backend files
cp -r ancestree-backend/* ancestree-deploy/
# Copy built frontend
cp -r ancestree-app/dist ancestree-deploy/

# Copy deployment checker script
cp check-deployment.sh ancestree-deploy/
chmod +x ancestree-deploy/check-deployment.sh

# Copy diagnostic script
cp diagnose.sh ancestree-deploy/
chmod +x ancestree-deploy/diagnose.sh

# Create a comprehensive .env.example file
echo "📝 Creating .env.example with all required configuration..."
cat > ancestree-deploy/.env.example << 'EOF'
# =============================================================================
# ANCESTREE PRODUCTION ENVIRONMENT CONFIGURATION
# =============================================================================
# IMPORTANT: Copy this file to .env and fill in ALL values before starting the server
# Command: cp .env.example .env && nano .env

# -----------------------------------------------------------------------------
# AWS S3 Configuration (REQUIRED for image uploads)
# -----------------------------------------------------------------------------
# Get these credentials from AWS IAM Console
# See: https://console.aws.amazon.com/iam/
AWS_ACCESS_KEY_ID=your_aws_access_key_here
AWS_SECRET_ACCESS_KEY=your_aws_secret_key_here
AWS_REGION=eu-central-1
S3_BUCKET_NAME=your-s3-bucket-name

# -----------------------------------------------------------------------------
# Google Maps API Configuration (REQUIRED for map functionality)
# -----------------------------------------------------------------------------
# Get your API key from: https://console.cloud.google.com/apis/credentials
GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here

# -----------------------------------------------------------------------------
# Server Configuration
# -----------------------------------------------------------------------------
NODE_ENV=production
PORT=3001

# -----------------------------------------------------------------------------
# JWT Configuration (REQUIRED for authentication)
# -----------------------------------------------------------------------------
# Generate a secure random string (at least 32 characters)
# Example: openssl rand -base64 32
JWT_SECRET=change-this-to-a-secure-random-string

# -----------------------------------------------------------------------------
# CORS Configuration
# -----------------------------------------------------------------------------
# Set this to your domain or IP address
# Examples:
#   - With domain: https://yourfamilytree.com
#   - With IP: http://YOUR_STATIC_IP:3001
#   - Local: http://localhost:3001
FRONTEND_URL=http://localhost:3001

# =============================================================================
# DEPLOYMENT CHECKLIST:
# =============================================================================
# [ ] AWS S3 bucket created and configured
# [ ] AWS IAM user created with S3 access
# [ ] Google Maps API key obtained and configured
# [ ] JWT_SECRET changed to a secure random string
# [ ] FRONTEND_URL set to your domain or IP
# [ ] Port 3001 opened in firewall
# [ ] All values above configured (no placeholders remaining)
# =============================================================================
EOF

echo "✅ Deployment package created in ./ancestree-deploy/"
echo ""
echo "⚠️  CRITICAL: Before uploading to the server:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "❌ The deployment package does NOT include your sensitive credentials!"
echo "❌ You MUST create a .env file on the server with proper configuration!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 Deployment Steps:"
echo ""
echo "1. 📤 Upload the deployment package to your server:"
echo "   scp -r ancestree-deploy ubuntu@YOUR_SERVER_IP:~/"
echo ""
echo "2. 🔐 SSH into your server and configure environment:"
echo "   ssh ubuntu@YOUR_SERVER_IP"
echo "   cd ancestree-deploy"
echo "   cp .env.example .env"
echo "   nano .env  # Edit and fill in ALL required values"
echo "   ./check-deployment.sh  # Verify configuration"
echo ""
echo "3. 📦 Install dependencies:"
echo "   npm install"
echo ""
echo "4. 🚀 Start the server:"
echo "   pm2 start ecosystem.config.json --env production"
echo "   pm2 save"
echo ""
echo "5. ✅ Verify the deployment:"
echo "   curl http://YOUR_SERVER_IP:3001/api/health"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "⚠️  COMMON ISSUES:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "❌ 'Access Denied' on image upload → AWS credentials missing or incorrect"
echo "❌ '401 Unauthorized' → JWT_SECRET not set or doesn't match"
echo "❌ Map not loading → GOOGLE_MAPS_API_KEY missing or incorrect"
echo "❌ CORS errors → FRONTEND_URL not set correctly"
echo ""
echo "📖 For detailed instructions, see: AWS_LIGHTSAIL_DEPLOYMENT.md"
