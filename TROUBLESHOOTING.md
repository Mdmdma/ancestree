# Ancestree Troubleshooting Guide

This guide helps you diagnose and fix common issues when deploying and running Ancestree.

## 🔴 Image Upload Issues

### Problem: "Access Denied" error when uploading images (HTTP 500)

**Symptoms:**
- Browser console shows: `Failed to load resource: the server responded with a status of 500 (Internal Server Error)`
- Error message: `Upload error: Error: Upload failed: Access Denied`
- Works fine on localhost but fails on deployed server

**Root Cause:**
AWS S3 credentials are missing or incorrect in the server's `.env` file.

**Solution:**

1. **Check if .env file exists on the server:**
   ```bash
   ssh ubuntu@YOUR_SERVER_IP
   cd ancestree-deploy  # or your deployment directory
   ls -la .env
   ```

2. **If .env file is missing, create it:**
   ```bash
   cp .env.example .env
   nano .env
   ```

3. **Verify AWS credentials are configured:**
   The `.env` file must contain these lines with actual values (not placeholders):
   ```env
   AWS_ACCESS_KEY_ID=your_actual_access_key_here
   AWS_SECRET_ACCESS_KEY=your_actual_secret_key_here
   AWS_REGION=eu-central-1
   S3_BUCKET_NAME=your-bucket-name
   ```

4. **Restart the server:**
   ```bash
   pm2 restart ancestree-server
   # or
   pm2 restart all
   ```

5. **Verify credentials are loaded:**
   Check the server logs when it starts:
   ```bash
   pm2 logs ancestree-server
   ```
   
   If you see this warning, credentials are NOT configured:
   ```
   ⚠️  WARNING: AWS S3 credentials are not configured!
   ```
   
   If credentials are correct, you should NOT see this warning.

**How to Get AWS Credentials:**

1. Go to AWS IAM Console: https://console.aws.amazon.com/iam/
2. Create a new user (if you haven't already)
3. Attach policy: `AmazonS3FullAccess` or create a custom policy for your bucket
4. Generate access keys (Access Key ID and Secret Access Key)
5. Copy these values to your `.env` file

**Testing:**

After configuring, test the upload:
1. Log in to your deployed site
2. Go to the Photos tab
3. Try uploading an image
4. Check browser console and server logs for errors

---

## 🔴 Authentication Issues

### Problem: "401 Unauthorized" errors

**Root Cause:**
JWT_SECRET not set or doesn't match between deployments.

**Solution:**
1. Set JWT_SECRET in `.env`:
   ```env
   JWT_SECRET=your-secure-random-string-at-least-32-characters
   ```
2. Generate a secure secret:
   ```bash
   openssl rand -base64 32
   ```
3. Restart server: `pm2 restart all`

---

## 🔴 Map Not Loading

### Problem: Google Maps shows blank or error

**Root Cause:**
Google Maps API key not configured or has restrictions.

**Solution:**
1. Set `GOOGLE_MAPS_API_KEY` in `.env`:
   ```env
   GOOGLE_MAPS_API_KEY=your_google_maps_api_key
   ```
2. Verify key has these APIs enabled:
   - Maps JavaScript API
   - Geocoding API
3. Check API restrictions allow your domain/IP
4. Restart server

---

## 🔴 CORS Errors

### Problem: Browser console shows CORS policy errors

**Symptoms:**
```
Access to fetch at 'http://your-server:3001/api/...' from origin 'http://your-domain' 
has been blocked by CORS policy
```

**Root Cause:**
Frontend URL not added to CORS whitelist.

**Solution:**
1. Set `FRONTEND_URL` in `.env`:
   ```env
   FRONTEND_URL=https://yourdomain.com
   # or for IP:
   FRONTEND_URL=http://YOUR_IP:3001
   ```
2. Restart server: `pm2 restart all`

---

## 🔴 Build Issues

### Problem: Build fails with "VITE_API_BASE_URL not defined"

**Solution:**
1. Check `ancestree-app/.env.production` exists
2. Verify it contains:
   ```env
   VITE_API_BASE_URL=/api
   VITE_GOOGLE_MAPS_API_KEY=your_key
   ```
3. Rebuild: `cd ancestree-app && npm run build`

---

## 🔴 Server Won't Start

### Problem: PM2 shows server in error state

**Diagnostics:**
```bash
pm2 logs ancestree-server --lines 50
pm2 describe ancestree-server
```

**Common Causes:**

1. **Port already in use:**
   ```bash
   sudo lsof -i :3001
   sudo kill -9 PID
   ```

2. **Database file missing:**
   - Check `databases/` folder exists
   - Check file permissions: `chmod 644 databases/*.db`

3. **Node modules missing:**
   ```bash
   npm install
   ```

---

## 🛠️ Debugging Checklist

When something goes wrong, check these in order:

### 1. Server Status
```bash
pm2 status
pm2 logs --lines 100
```

### 2. Environment Variables
```bash
cat .env | grep -v "^#" | grep -v "^$"
```
Verify all required variables are set (no placeholders like `your_key_here`).

### 3. Network Connectivity
```bash
# Test if server is responding
curl http://localhost:3001/api/health

# Test from outside
curl http://YOUR_SERVER_IP:3001/api/health
```

### 4. Firewall
```bash
sudo ufw status
# Ensure port 3001 is allowed
sudo ufw allow 3001
```

### 5. File Permissions
```bash
ls -la databases/
ls -la .env
# .env should be readable: -rw-r--r--
```

### 6. AWS S3 Bucket
- Verify bucket exists in AWS console
- Check bucket is in the correct region
- Verify IAM user has `s3:PutObject` permission
- Test credentials:
  ```bash
  aws s3 ls s3://your-bucket-name --profile your-profile
  ```

---

## 📋 Quick Fix Commands

### Restart Everything
```bash
pm2 restart all
pm2 logs --lines 50
```

### Full Redeployment
```bash
# On local machine
./build-for-deployment.sh
scp -r ancestree-deploy ubuntu@YOUR_IP:~/ancestree-deploy-new

# On server
cd ~
pm2 stop all
mv ancestree-deploy ancestree-deploy-backup
mv ancestree-deploy-new ancestree-deploy
cd ancestree-deploy
cp ../ancestree-deploy-backup/.env .
npm install
pm2 restart all
```

### Check All Required Environment Variables
```bash
# Run this on the server to verify all variables are set
echo "Checking environment configuration..."
[ -f .env ] && echo "✓ .env file exists" || echo "✗ .env file missing!"
grep -q "AWS_ACCESS_KEY_ID=" .env && [ "$(grep AWS_ACCESS_KEY_ID .env | cut -d'=' -f2)" != "your_aws_access_key_here" ] && echo "✓ AWS_ACCESS_KEY_ID is set" || echo "✗ AWS_ACCESS_KEY_ID not configured"
grep -q "AWS_SECRET_ACCESS_KEY=" .env && [ "$(grep AWS_SECRET_ACCESS_KEY .env | cut -d'=' -f2)" != "your_aws_secret_key_here" ] && echo "✓ AWS_SECRET_ACCESS_KEY is set" || echo "✗ AWS_SECRET_ACCESS_KEY not configured"
grep -q "GOOGLE_MAPS_API_KEY=" .env && [ "$(grep GOOGLE_MAPS_API_KEY .env | cut -d'=' -f2)" != "your_google_maps_api_key_here" ] && echo "✓ GOOGLE_MAPS_API_KEY is set" || echo "✗ GOOGLE_MAPS_API_KEY not configured"
grep -q "JWT_SECRET=" .env && [ "$(grep JWT_SECRET .env | cut -d'=' -f2)" != "change-this-to-a-secure-random-string" ] && echo "✓ JWT_SECRET is set" || echo "✗ JWT_SECRET not configured"
```

---

## 🆘 Still Having Issues?

If you've tried everything above and still have issues:

1. **Collect diagnostics:**
   ```bash
   # On the server
   echo "=== PM2 Status ===" > debug-info.txt
   pm2 status >> debug-info.txt
   echo "=== Last 100 Log Lines ===" >> debug-info.txt
   pm2 logs --lines 100 --nostream >> debug-info.txt
   echo "=== Environment Check ===" >> debug-info.txt
   env | grep -E "NODE_ENV|AWS_|GOOGLE_MAPS" >> debug-info.txt
   cat debug-info.txt
   ```

2. **Check these files in the project:**
   - `AWS_LIGHTSAIL_DEPLOYMENT.md` - Full deployment guide
   - `AWS_S3_SETUP.md` - S3 configuration details
   - `IMAGE_FEATURE_README.md` - Image upload feature documentation

3. **Enable debug mode:**
   In `.env`, add:
   ```env
   DEBUG=*
   NODE_ENV=development
   ```
   Then restart: `pm2 restart all --update-env`

4. **Create an issue on GitHub** with:
   - Description of the problem
   - Error messages from browser console
   - Server logs from `pm2 logs`
   - Output from the environment check script above
