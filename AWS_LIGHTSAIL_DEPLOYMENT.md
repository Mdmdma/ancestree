# AWS Lightsail Deployment Guide for Ancestree

This guide will help you deploy Ancestree on AWS Lightsail.

## Prerequisites

1. AWS account with Lightsail access
2. Domain name (optional but recommended)
3. Google Maps API key
4. AWS S3 bucket for image storage

## Step 1: Create Lightsail Instance

1. Go to AWS Lightsail console
2. Create a new instance
3. Choose "Linux/Unix" platform
4. Choose "Ubuntu 20.04 LTS" or newer
5. Choose instance plan (minimum $5/month for small family trees)
6. Give it a name like "ancestree-server"
7. Create instance

## Step 2: Configure Static IP (Recommended)

1. In Lightsail console, go to Networking
2. Create a static IP
3. Attach it to your instance
4. Note the IP address for later

## Step 3: Configure Firewall

1. In your instance's Networking tab
2. Add custom rule: Application: Custom, Protocol: TCP, Port: 3001
3. Or use the firewall commands on the server:
   ```bash
   sudo ufw allow 3001
   sudo ufw allow 22  # SSH
   sudo ufw allow 80  # HTTP
   sudo ufw allow 443 # HTTPS
   sudo ufw enable
   ```

## Step 4: Connect and Setup Server

SSH into your instance:
```bash
ssh ubuntu@YOUR_STATIC_IP
```

Install Node.js and dependencies:
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2 for process management
sudo npm install -g pm2

# Install git (if you want to clone directly)
sudo apt install git -y
```

## Step 5: Deploy Application

### Option A: Upload Pre-built Package

1. Run the build script locally:
   ```bash
   ./build-for-deployment.sh
   ```

2. Upload the `ancestree-deploy` folder to your server using SCP:
   ```bash
   scp -r ancestree-deploy ubuntu@YOUR_STATIC_IP:~/
   ```

3. On the server:
   ```bash
   cd ancestree-deploy
   ```

### Option B: Clone and Build on Server

```bash
git clone https://github.com/YOUR_USERNAME/ancestree.git
cd ancestree/ancestree-backend
npm install
cd ../ancestree-app
npm install
npm run build
cd ../ancestree-backend
```

## Step 6: Configure Environment

Create the production environment file:
```bash
cp .env.example .env
nano .env
```

Configure your `.env` file:
```env
# Google Maps API Key
VITE_GOOGLE_MAPS_API_KEY=your_google_maps_api_key

# API URL - use your domain or static IP
VITE_API_BASE_URL=/api

# Production environment
NODE_ENV=production
PORT=3001

# AWS S3 Configuration (if using image uploads)
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=us-east-1
S3_BUCKET_NAME=your-bucket-name

# Frontend URL for CORS (use your domain or IP)
FRONTEND_URL=http://YOUR_STATIC_IP
```

## Step 7: Start the Application

### Using PM2 (Recommended for Production)

```bash
# Start with PM2
pm2 start ecosystem.config.json --env production

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup
# Follow the instructions printed by the command above
```

### Manual Start (for testing)

```bash
NODE_ENV=production npm start
```

## Step 8: Test the Deployment

Visit your application:
- `http://YOUR_STATIC_IP:3001`

## Step 9: Setup Domain (Optional but Recommended)

### Configure DNS
1. In your domain registrar, add an A record pointing to your static IP
2. Update your `.env` file with your domain:
   ```env
   FRONTEND_URL=https://yourfamilytree.com
   ```

### Setup HTTPS with Let's Encrypt (Recommended)

Install and configure nginx as reverse proxy:
```bash
sudo apt install nginx certbot python3-certbot-nginx -y

# Create nginx configuration
sudo nano /etc/nginx/sites-available/ancestree
```

Nginx configuration:
```nginx
server {
    listen 80;
    server_name yourfamilytree.com www.yourfamilytree.com;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable the site and get SSL certificate:
```bash
sudo ln -s /etc/nginx/sites-available/ancestree /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
sudo certbot --nginx -d yourfamilytree.com -d www.yourfamilytree.com
```

## Step 10: Monitoring and Maintenance

### PM2 Commands
```bash
pm2 status          # Check status
pm2 logs ancestree  # View logs
pm2 restart ancestree # Restart app
pm2 stop ancestree  # Stop app
pm2 delete ancestree # Remove app
```

### Database Backup
```bash
# Backup SQLite database
cp ancestree.db ancestree.db.backup.$(date +%Y%m%d)
```

### Updates
```bash
# Pull latest changes
git pull origin main

# Rebuild frontend if needed
cd ancestree-app
npm run build
cd ../ancestree-backend

# Restart application
pm2 restart ancestree
```

## Troubleshooting

### Check logs
```bash
pm2 logs ancestree
tail -f logs/combined.log
```

### Check if port is open
```bash
sudo netstat -tlnp | grep :3001
```

### Check firewall
```bash
sudo ufw status
```

### Database issues
The SQLite database file should be writable by the node process. If you have permission issues:
```bash
chmod 644 ancestree.db
```

## Security Considerations

1. **Always use HTTPS in production**
2. **Keep your system updated**: `sudo apt update && sudo apt upgrade`
3. **Use strong passwords**
4. **Regularly backup your database**
5. **Monitor your application logs**
6. **Consider setting up automated security updates**

## Cost Estimation

- Lightsail instance: $5-20/month (depending on traffic)
- Domain: $10-15/year
- S3 storage for images: $1-5/month (depending on usage)
- Total: ~$60-250/year

## Support

If you encounter issues:
1. Check the application logs: `pm2 logs ancestree`
2. Check system logs: `sudo journalctl -u nginx` (if using nginx)
3. Verify your environment configuration
4. Check firewall settings
