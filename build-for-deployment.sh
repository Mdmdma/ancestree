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

# Copy environment template
cp ancestree-app/.env.production ancestree-deploy/.env.example

echo "✅ Deployment package created in ./ancestree-deploy/"
echo ""
echo "📋 Next steps for AWS Lightsail deployment:"
echo "1. Upload the ancestree-deploy folder to your Lightsail instance"
echo "2. Configure the .env file with your domain/IP"
echo "3. Install Node.js and npm on your Lightsail instance"
echo "4. Run 'npm install' in the deployment folder"
echo "5. Set NODE_ENV=production"
echo "6. Start the server with 'npm start' or use PM2"
echo ""
echo "🔧 Don't forget to:"
echo "- Open port 3001 in Lightsail firewall"
echo "- Configure your domain DNS if using a custom domain"
echo "- Set up SSL certificate for HTTPS (recommended)"
