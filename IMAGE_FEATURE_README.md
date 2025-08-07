# Image Upload Feature Implementation

## Overview

The Ancestree application now includes a comprehensive image upload and management system that allows users to:

- Upload family photos to AWS S3
- Tag people in images
- View images in a gallery
- Associate family members with photos
- Manage image descriptions and metadata

## Features

### 📸 Image Gallery
- Grid-based image gallery with thumbnails
- Click to view full-size images
- Upload new images with descriptions
- Delete images (removes from both database and S3)

### 🏷️ People Tagging
- Tag family members in photos
- Associate multiple people with each image
- Remove people tags
- Click on tagged people to select them in the family tree

### 🗄️ Database Schema
- `images` table: Stores image metadata and S3 references
- `image_people` table: Many-to-many relationship between images and family members
- Automatic cleanup when people or images are deleted

### ☁️ Cloud Storage
- Images stored securely in AWS S3
- Automatic file naming and organization
- Support for JPEG, PNG, GIF, and WebP formats
- 10MB file size limit
- Public read access for displaying images

## Technical Implementation

### Backend Changes

#### New Dependencies
```json
{
  "aws-sdk": "^2.1534.0",
  "multer": "^1.4.5-lts.1", 
  "multer-s3": "^3.0.1",
  "uuid": "^9.0.1"
}
```

#### Database Tables
```sql
-- Images table
CREATE TABLE images (
  id TEXT PRIMARY KEY,
  filename TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  s3_key TEXT NOT NULL,
  s3_url TEXT NOT NULL,
  description TEXT,
  upload_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  file_size INTEGER,
  mime_type TEXT,
  uploaded_by TEXT
);

-- Image-people associations
CREATE TABLE image_people (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  image_id TEXT NOT NULL,
  person_id TEXT NOT NULL,
  position_x REAL,
  position_y REAL,
  width REAL,
  height REAL,
  FOREIGN KEY (image_id) REFERENCES images (id) ON DELETE CASCADE,
  FOREIGN KEY (person_id) REFERENCES nodes (id) ON DELETE CASCADE,
  UNIQUE(image_id, person_id)
);
```

#### API Endpoints
- `POST /api/images/upload` - Upload new image
- `GET /api/images` - Get all images with people
- `GET /api/images/:id` - Get specific image with people
- `PUT /api/images/:id` - Update image description
- `DELETE /api/images/:id` - Delete image and S3 file
- `POST /api/images/:imageId/people` - Tag person in image
- `DELETE /api/images/:imageId/people/:personId` - Remove person tag
- `PUT /api/images/:imageId/people/:personId` - Update person position

### Frontend Changes

#### New Components
- `ImageGallery.jsx` - Main image management interface
- Integrated into sidebar with tab navigation

#### Features
- Tabbed interface (Editor/Photos)
- Drag & drop image upload
- Gallery grid view
- Full-size image viewer
- People tagging interface
- Person selection integration

## Setup Instructions

### 1. AWS S3 Configuration
Follow the detailed setup guide in `AWS_S3_SETUP.md`:
- Create S3 bucket
- Configure bucket policy and CORS
- Create IAM user with appropriate permissions
- Set up environment variables

### 2. Environment Variables
Copy `.env.example` to `.env` in the backend directory:
```bash
cd ancestree-backend
cp .env.example .env
```

Edit `.env` with your AWS credentials:
```env
AWS_ACCESS_KEY_ID=your_access_key_id
AWS_SECRET_ACCESS_KEY=your_secret_access_key
AWS_REGION=us-east-1
S3_BUCKET_NAME=ancestree-images
```

### 3. Install Dependencies
```bash
cd ancestree-backend
npm install
```

### 4. Start the Application
```bash
# Backend
cd ancestree-backend
npm start

# Frontend (in another terminal)
cd ancestree-app
npm run dev
```

## Usage

### Uploading Images
1. Click the "📸 Photos" tab in the sidebar
2. Click "📤 Upload Image"
3. Optionally add a description
4. Select an image file (max 10MB)
5. Image is automatically uploaded to S3 and saved to database

### Tagging People
1. View an image in the gallery
2. Click "🏷 Tag People"
3. Select a person from the family tree
4. Click "Tag This Person"
5. The person is now associated with the image

### Managing Images
- **View**: Click any thumbnail to see full size
- **Delete**: Click "🗑 Delete Image" when viewing an image
- **Edit Description**: Update image descriptions in the image view
- **Remove Tags**: Use "Remove" button next to tagged people

## Security Considerations

### AWS S3 Security
- Public read access enabled for image display
- Write access restricted to application
- Separate IAM user with minimal required permissions
- CORS configured for web access

### File Upload Security
- File type validation (images only)
- File size limits (10MB max)
- Unique filename generation with UUID
- Organized folder structure in S3

### Database Security
- Foreign key constraints ensure data integrity
- Cascade deletes prevent orphaned records
- Unique constraints prevent duplicate tags

## Cost Considerations

### AWS S3 Costs
- Storage: ~$0.023 per GB per month
- Requests: Minimal cost for family photos
- Data transfer: Free for first 100GB per month
- Estimated cost for 1000 family photos (~5GB): ~$0.12/month

## Future Enhancements

### Planned Features
- Image position tagging (click on faces to tag)
- Facial recognition integration
- Image search by people
- Bulk image upload
- Image albums/collections
- Image compression and optimization
- Advanced image editing tools

### Technical Improvements
- CDN integration for faster loading
- Image thumbnail generation
- Progressive image loading
- Offline image caching
- Image metadata extraction (EXIF data)

## Troubleshooting

### Common Issues
1. **Images not uploading**: Check AWS credentials and S3 permissions
2. **Images not displaying**: Verify S3 bucket public read access
3. **CORS errors**: Check S3 CORS configuration
4. **Large file errors**: Ensure files are under 10MB limit

### Debugging
- Check browser console for frontend errors
- Check server logs for backend errors
- Verify AWS S3 bucket contents
- Test AWS credentials with AWS CLI

## File Structure
```
ancestree/
├── ancestree-backend/
│   ├── .env.example
│   ├── database.js (updated with image tables)
│   ├── server.js (updated with image endpoints)
│   └── package.json (updated dependencies)
├── ancestree-app/
│   ├── src/
│   │   ├── ImageGallery.jsx (new)
│   │   ├── App.jsx (updated with tabs)
│   │   └── api.js (updated with image functions)
└── AWS_S3_SETUP.md (setup guide)
```
