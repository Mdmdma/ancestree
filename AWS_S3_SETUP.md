# AWS S3 Setup Guide for Ancestree Image Storage

This guide explains how to configure AWS S3 for **private bucket** storage with **presigned URLs** for secure image uploads and viewing.

## Architecture Overview

Ancestree uses a **private S3 bucket** with presigned URLs:
- **Upload**: Client gets a presigned PUT URL from the backend, then uploads directly to S3
- **View**: Backend generates presigned GET URLs with 1-hour expiry for image viewing
- **Export**: Backend proxy fetches images directly from S3 using server credentials

This approach provides:
- ✅ **Better security**: No public bucket access
- ✅ **Direct uploads**: Client uploads to S3 without going through backend
- ✅ **Encrypted metadata**: S3 keys are encrypted in database when encryption is enabled
- ✅ **Time-limited access**: Presigned URLs expire after a set time

## Prerequisites
- AWS Account
- AWS CLI installed (optional but recommended)

## Step 1: Create S3 Bucket

### Using AWS Console
1. Go to AWS S3 Console: https://console.aws.amazon.com/s3/
2. Click "Create bucket"
3. Enter bucket name: `ancestree-images` (or your preferred name)
4. Choose your preferred region (e.g., `eu-central-1` for Frankfurt)
5. **Important**: Keep "Block all public access" **ENABLED** (default)
6. Enable bucket versioning (recommended for backup)
7. Click "Create bucket"

### Using AWS CLI
```bash
aws s3 mb s3://ancestree-images --region eu-central-1
```

## Step 2: Bucket Policy (Private - No Public Access)

**No bucket policy is needed** for private buckets with presigned URLs. The default settings block all public access.

Verify your bucket has these settings in the "Permissions" tab:
- Block all public access: **ON** (all 4 checkboxes should be checked)
- Bucket policy: **Empty** or restricted to your IAM user

## Step 3: Configure CORS Policy

CORS is required for presigned URL uploads from the browser.

1. Go to your bucket in the S3 console
2. Click on the "Permissions" tab
3. Scroll down to "Cross-origin resource sharing (CORS)"
4. Add this CORS configuration:

```json
[
    {
        "AllowedHeaders": [
            "*"
        ],
        "AllowedMethods": [
            "GET",
            "PUT",
            "HEAD"
        ],
        "AllowedOrigins": [
            "http://localhost:5173",
            "http://localhost:5174",
            "https://ancestree.ch",
            "https://www.ancestree.ch"
        ],
        "ExposeHeaders": [
            "ETag",
            "Content-Length",
            "Content-Type"
        ],
        "MaxAgeSeconds": 3600
    }
]
```

### For Development Only (Less Secure):
```json
[
    {
        "AllowedHeaders": ["*"],
        "AllowedMethods": ["GET", "PUT", "HEAD"],
        "AllowedOrigins": ["*"],
        "ExposeHeaders": ["ETag", "Content-Length", "Content-Type"],
        "MaxAgeSeconds": 3600
    }
]
```

## Step 4: Create IAM User and Access Keys

### Create Custom IAM Policy (Recommended)

1. Go to IAM Console: https://console.aws.amazon.com/iam/
2. Click "Policies" → "Create policy"
3. Choose "JSON" tab and paste:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "S3ObjectOperations",
            "Effect": "Allow",
            "Action": [
                "s3:GetObject",
                "s3:PutObject",
                "s3:DeleteObject"
            ],
            "Resource": "arn:aws:s3:::YOUR-BUCKET-NAME/*"
        },
        {
            "Sid": "S3BucketOperations",
            "Effect": "Allow",
            "Action": [
                "s3:ListBucket"
            ],
            "Resource": "arn:aws:s3:::YOUR-BUCKET-NAME"
        }
    ]
}
```

**Replace `YOUR-BUCKET-NAME` with your actual bucket name.**

**Note on permissions:**
- `s3:GetObject` - Required for presigned GET URLs (viewing images)
- `s3:PutObject` - Required for presigned PUT URLs (uploading images)  
- `s3:DeleteObject` - Required for deleting individual images and family cleanup
- `s3:ListBucket` - **Required** for listing/deleting all images in a family folder during account deletion and orphan cleanup

Without `s3:ListBucket`, the automatic cleanup of orphaned S3 folders will fail gracefully (logged but skipped).

4. Name the policy: `AncestreeS3Access`

### Create IAM User

1. Go to IAM Console → Users → "Create user"
2. Enter username: `ancestree-upload-user`
3. Click "Next"
4. Select "Attach policies directly"
5. Search for and select your `AncestreeS3Access` policy
6. Complete user creation
7. Go to the user → "Security credentials" → "Create access key"
8. Choose "Application running outside AWS"
9. **Important**: Save the Access Key ID and Secret Access Key securely

## Step 5: Configure Environment Variables

Create or edit `.env` file in your backend directory:

```bash
# AWS S3 Configuration
AWS_ACCESS_KEY_ID=your_actual_access_key_id
AWS_SECRET_ACCESS_KEY=your_actual_secret_access_key
AWS_REGION=eu-central-1
S3_BUCKET_NAME=ancestree-images
```

## Step 6: Verify Configuration

1. Start your backend server
2. Check the console for AWS configuration messages
3. Try uploading an image through the application
4. Verify the image displays correctly (via presigned URL)

### Testing with AWS CLI
```bash
# List bucket contents
aws s3 ls s3://ancestree-images/

# Test generating a presigned URL
aws s3 presign s3://ancestree-images/images/test.jpg --expires-in 3600
```

## How Presigned URLs Work

### Upload Flow
```
1. Client → Backend: "I want to upload image.jpg (5MB, image/jpeg)"
2. Backend → Client: Presigned PUT URL (valid 5 minutes)
3. Client → S3: Direct PUT request with file
4. Client → Backend: "Upload complete, save metadata"
5. Backend: Saves image record to database
```

### View Flow
```
1. Client → Backend: "Load all images"
2. Backend: Fetches image metadata from database
3. Backend: Generates presigned GET URLs for each image
4. Backend → Client: Image list with presigned URLs
5. Client: Displays images using presigned URLs (valid 1 hour)
```

## URL Expiration Times

| Operation | Expiry | Configurable In |
|-----------|--------|-----------------|
| Upload URL | 5 minutes | `PRESIGNED_URL_EXPIRY_UPLOAD` in server.js |
| View URL | 1 hour | `PRESIGNED_URL_EXPIRY_VIEW` in server.js |

For long sessions, the client may need to refresh images if URLs expire. The application handles this automatically by fetching new presigned URLs when loading images.

## Security Best Practices

### For Production:
1. **Never commit `.env` file** to version control
2. **Restrict CORS origins** to your actual domain(s)
3. **Enable bucket versioning** for accidental deletion recovery
4. **Enable server-side encryption** (SSE-S3 or SSE-KMS)
5. **Set up CloudTrail** for audit logging
6. **Use VPC endpoints** if backend runs on AWS

### Enable Server-Side Encryption
In bucket Properties → Default encryption:
- Choose "Server-side encryption with Amazon S3 managed keys (SSE-S3)"

### Enable Versioning
In bucket Properties → Bucket Versioning:
- Click "Enable"

## Troubleshooting

### Common Issues

| Error | Cause | Solution |
|-------|-------|----------|
| `403 Forbidden` on upload | IAM permissions | Verify user has `s3:PutObject` permission |
| `CORS error` | CORS not configured | Add CORS configuration with your origin |
| `SignatureDoesNotMatch` | Clock skew | Sync server time (NTP) |
| `URL expired` | Presigned URL expired | URLs expire after set time, refresh page |
| `NoSuchBucket` | Wrong bucket name | Check S3_BUCKET_NAME in .env |

### Debug Logging
The backend logs presigned URL operations. Check server logs for:
```
[Image Proxy] Fetching image from S3: images/family/uuid.jpg
```

## Migration from Public Bucket

If migrating from an existing public bucket:

1. **Update bucket settings**: Enable "Block all public access"
2. **Remove bucket policy**: Delete the public read policy
3. **Update CORS**: Ensure CORS is configured for presigned uploads
4. **Restart backend**: New presigned URL code will handle access
5. **Test thoroughly**: Verify upload, view, and export work

Existing images will continue to work - they will be accessed via presigned URLs instead of public URLs.

## Cost Optimization

- S3 storage: ~$0.023 per GB per month
- PUT requests: ~$0.005 per 1,000 requests
- GET requests: ~$0.0004 per 1,000 requests
- Data transfer: First 100GB/month free, then ~$0.09/GB

For family photo storage, costs are typically minimal ($1-5/month).

### Cost Reduction Tips:
- Use S3 Intelligent Tiering for automatic cost optimization
- Set lifecycle rules to move old images to cheaper storage classes
- Monitor usage through AWS Cost Explorer
