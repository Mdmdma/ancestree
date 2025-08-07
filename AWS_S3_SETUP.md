# AWS S3 Setup Guide for Ancestree Image Storage

## Prerequisites
- AWS Account
- AWS CLI installed (optional but recommended)

## Step 1: Create S3 Bucket

### Option A: Using AWS Console
1. Go to AWS S3 Console: https://console.aws.amazon.com/s3/
2. Click "Create bucket"
3. Enter bucket name: `ancestree-images` (or your preferred name)
4. Choose your preferred region (e.g., `us-east-1`)
5. **Important**: Uncheck "Block all public access" since we need public read access for images
6. Acknowledge the warning about public access
7. Click "Create bucket"

### Option B: Using AWS CLI
```bash
aws s3 mb s3://ancestree-images --region us-east-1
```

## Step 2: Configure Bucket Policy for Public Read Access

1. Go to your bucket in the S3 console
2. Click on the "Permissions" tab
3. Scroll down to "Bucket policy"
4. Add this policy (replace `ancestree-images` with your bucket name):

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "PublicReadGetObject",
            "Effect": "Allow",
            "Principal": "*",
            "Action": "s3:GetObject",
            "Resource": "arn:aws:s3:::ancestree-images/*"
        }
    ]
}
```

## Step 3: Configure CORS Policy

1. In the same "Permissions" tab, scroll to "Cross-origin resource sharing (CORS)"
2. Add this CORS configuration:

```json
[
    {
        "AllowedHeaders": ["*"],
        "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
        "AllowedOrigins": ["*"],
        "ExposeHeaders": ["ETag"]
    }
]
```

## Step 4: Create IAM User and Access Keys

### Option A: Using AWS Console
1. Go to IAM Console: https://console.aws.amazon.com/iam/
2. Click "Users" in the left sidebar
3. Click "Add users"
4. Enter username: `ancestree-upload-user`
5. Select "Programmatic access"
6. Click "Next: Permissions"
7. Click "Attach existing policies directly"
8. Search for and select `AmazonS3FullAccess` (or create a custom policy for more security)
9. Complete the user creation
10. **Important**: Save the Access Key ID and Secret Access Key

### Option B: Custom IAM Policy (More Secure)
Instead of `AmazonS3FullAccess`, create a custom policy with minimal permissions:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "s3:GetObject",
                "s3:PutObject",
                "s3:DeleteObject"
            ],
            "Resource": "arn:aws:s3:::ancestree-images/*"
        },
        {
            "Effect": "Allow",
            "Action": [
                "s3:ListBucket"
            ],
            "Resource": "arn:aws:s3:::ancestree-images"
        }
    ]
}
```

## Step 5: Configure Environment Variables

1. Copy `.env.example` to `.env` in your backend directory:
```bash
cp .env.example .env
```

2. Edit `.env` file with your actual values:
```
AWS_ACCESS_KEY_ID=your_actual_access_key_id
AWS_SECRET_ACCESS_KEY=your_actual_secret_access_key
AWS_REGION=us-east-1
S3_BUCKET_NAME=ancestree-images
```

## Step 6: Security Considerations

### For Production:
1. **Never commit `.env` file to version control**
2. Use more restrictive IAM policies
3. Consider using AWS STS (Security Token Service) for temporary credentials
4. Enable bucket versioning for backup
5. Consider encrypting objects at rest
6. Set up CloudTrail for audit logging
7. Use specific CORS origins instead of "*"

### Enhanced Security Bucket Policy:
```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "PublicReadGetObject",
            "Effect": "Allow",
            "Principal": "*",
            "Action": "s3:GetObject",
            "Resource": "arn:aws:s3:::ancestree-images/*",
            "Condition": {
                "StringEquals": {
                    "s3:ExistingObjectTag/public": "true"
                }
            }
        }
    ]
}
```

### Enhanced CORS for Production:
```json
[
    {
        "AllowedHeaders": ["*"],
        "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
        "AllowedOrigins": ["http://localhost:3000", "https://yourdomain.com"],
        "ExposeHeaders": ["ETag"],
        "MaxAgeSeconds": 3000
    }
]
```

## Step 7: Testing

1. Start your backend server with the environment variables set
2. Try uploading an image through the application
3. Check that the image appears in your S3 bucket
4. Verify that the image URL is accessible in a browser

## Troubleshooting

### Common Issues:
1. **403 Forbidden**: Check bucket policy and IAM permissions
2. **CORS Error**: Verify CORS configuration
3. **Images not loading**: Check if bucket allows public read access
4. **Upload fails**: Verify IAM user has PutObject permission

### Testing AWS Credentials:
```bash
aws s3 ls s3://ancestree-images
```

If this works, your credentials are correctly configured.

## Cost Optimization

- S3 storage costs about $0.023 per GB per month
- Request costs are minimal for family photo storage
- Consider using S3 Intelligent Tiering for automatic cost optimization
- Monitor usage through AWS Cost Explorer
