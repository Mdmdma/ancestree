/**
 * Thumbnail Generation Utility
 * 
 * Client-side image thumbnail generation using Canvas API
 * - Resizes images to max 300px on longest dimension
 * - Maintains aspect ratio
 * - Outputs JPEG at 80% quality
 * - Optimized for mobile compatibility
 */

/**
 * Generate a thumbnail from an image file
 * @param {File|Blob} imageFile - The original image file
 * @param {number} maxDimension - Maximum dimension (width or height) in pixels
 * @param {number} quality - JPEG quality (0-1)
 * @returns {Promise<{blob: Blob, width: number, height: number}>}
 */
export async function generateThumbnail(imageFile, maxDimension = 300, quality = 0.8) {
  return new Promise((resolve, reject) => {
    // Create an image element to load the file
    const img = new Image();
    const objectUrl = URL.createObjectURL(imageFile);
    
    img.onload = () => {
      try {
        // Calculate new dimensions maintaining aspect ratio
        let { width, height } = img;
        
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            // Landscape: width is the longest dimension
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            // Portrait or square: height is the longest dimension
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }
        
        // Create canvas with calculated dimensions
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        
        // Draw the image on canvas (resized)
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        
        // Convert canvas to blob (JPEG format)
        canvas.toBlob(
          (blob) => {
            // Clean up
            URL.revokeObjectURL(objectUrl);
            
            if (blob) {
              resolve({ blob, width, height });
            } else {
              reject(new Error('Failed to generate thumbnail blob'));
            }
          },
          'image/jpeg',
          quality
        );
      } catch (error) {
        URL.revokeObjectURL(objectUrl);
        reject(error);
      }
    };
    
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to load image for thumbnail generation'));
    };
    
    // Start loading the image
    img.src = objectUrl;
  });
}

/**
 * Generate thumbnail filename from original filename
 * @param {string} originalFilename - Original image filename
 * @returns {string} Thumbnail filename (e.g., "photo.jpg" -> "photo.thumbnail.jpg")
 */
export function getThumbnailFilename(originalFilename) {
  const lastDot = originalFilename.lastIndexOf('.');
  if (lastDot > 0) {
    const baseName = originalFilename.substring(0, lastDot);
    const extension = originalFilename.substring(lastDot);
    // Always use .jpg for thumbnails regardless of original format
    return `${baseName}.thumbnail.jpg`;
  }
  return `${originalFilename}.thumbnail.jpg`;
}

/**
 * Generate thumbnail S3 key from original S3 key
 * @param {string} s3Key - Original S3 key (e.g., "images/familyname/photo.jpg")
 * @returns {string} Thumbnail S3 key (e.g., "images/familyname/photo.thumbnail.jpg")
 */
export function getThumbnailS3Key(s3Key) {
  const lastSlash = s3Key.lastIndexOf('/');
  const lastDot = s3Key.lastIndexOf('.');
  
  if (lastSlash >= 0 && lastDot > lastSlash) {
    const path = s3Key.substring(0, lastDot);
    const extension = s3Key.substring(lastDot);
    return `${path}.thumbnail.jpg`;
  }
  
  // Fallback if no extension found
  return `${s3Key}.thumbnail.jpg`;
}

/**
 * Batch process thumbnail generation with memory management
 * @param {Array<{file: File, id: string}>} items - Items to process
 * @param {number} batchSize - Number of items to process at once
 * @param {Function} onProgress - Progress callback (processed, total)
 * @returns {Promise<Array<{id: string, thumbnail: {blob: Blob, width: number, height: number}}>>}
 */
export async function batchGenerateThumbnails(items, batchSize = 3, onProgress = null) {
  const results = [];
  
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    
    // Process batch in parallel
    const batchResults = await Promise.all(
      batch.map(async (item) => {
        try {
          const thumbnail = await generateThumbnail(item.file);
          return { id: item.id, thumbnail, error: null };
        } catch (error) {
          console.error(`Failed to generate thumbnail for ${item.id}:`, error);
          return { id: item.id, thumbnail: null, error: error.message };
        }
      })
    );
    
    results.push(...batchResults);
    
    if (onProgress) {
      onProgress(Math.min(i + batchSize, items.length), items.length);
    }
    
    // Small delay between batches to allow garbage collection
    if (i + batchSize < items.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  return results;
}
