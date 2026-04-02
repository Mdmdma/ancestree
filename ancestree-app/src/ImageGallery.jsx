import { encryptedApi } from './encryptedApi';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { api } from './api';
import { useTranslation } from './locales/LanguageContext';
import PictureSlideshow from './PictureSlideshow';
import DescriptionTextarea from './components/DescriptionTextarea';
import Button from './components/Button';
import { generateThumbnail } from './thumbnailUtils';
import { extractImageDescription } from './exportUtils';

// Memoized ImageThumbnail component with lazy loading
const ImageThumbnail = React.memo(({ image, onClick, translations, onLoadFullImage }) => {
  const [currentSrc, setCurrentSrc] = useState(image.thumbnailUrl || image.s3Url);
  const [isLoadingFull, setIsLoadingFull] = useState(false);
  const imgRef = React.useRef(null);

  // Use Intersection Observer to detect when thumbnail is visible
  useEffect(() => {
    if (!image.thumbnailUrl || isLoadingFull) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !isLoadingFull) {
            setIsLoadingFull(true);
            // Load full image in background when thumbnail becomes visible
            const fullImg = new Image();
            fullImg.src = image.s3Url;
            fullImg.onload = () => {
              setCurrentSrc(image.s3Url);
              if (onLoadFullImage) {
                onLoadFullImage(image.id);
              }
            };
            fullImg.onerror = () => {
              console.warn(`Failed to load full image for ${image.id}, keeping thumbnail`);
            };
          }
        });
      },
      { rootMargin: '50px' } // Start loading slightly before visible
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => {
      if (imgRef.current) {
        observer.unobserve(imgRef.current);
      }
    };
  }, [image.id, image.s3Url, image.thumbnailUrl, isLoadingFull, onLoadFullImage]);

  return (
    <div
      ref={imgRef}
      style={{
        border: image.has_open_questions ? '3px solid #dc3545' : '1px solid #444',
        borderRadius: '8px',
        overflow: 'hidden',
        cursor: 'pointer',
        backgroundColor: '#2a2a2a',
        transition: 'transform 0.2s, border-color 0.2s'
      }}
      onClick={onClick}
      onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
      onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
    >
      <img
        src={currentSrc}
        alt={image.description || image.originalFilename}
        style={{
          width: '100%',
          height: '150px',
          objectFit: 'cover',
          display: 'block'
        }}
      />
      <div style={{ padding: '10px' }}>
        {image.description ? (
          <div style={{ fontSize: '12px', color: '#ffffff', marginBottom: '5px' }}>
            {(() => {
              // For gallery thumbnails, show first paragraph only and truncate if needed
              const firstParagraph = image.description.split('\n\n')[0].replace(/\n/g, ' ');
              return firstParagraph.length > 80 
                ? firstParagraph.substring(0, 80) + '...'
                : firstParagraph;
            })()}
          </div>
        ) : (
          <div style={{ fontSize: '12px', color: '#888', fontStyle: 'italic' }}>
            {translations.noDescription}
          </div>
        )}
        <div style={{ fontSize: '10px', color: '#aaaaaa' }}>
          {image.people.length} {image.people.length !== 1 ? translations.personsTagged : translations.personTagged}
        </div>
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison function - only re-render if these properties change
  return prevProps.image.id === nextProps.image.id &&
         prevProps.image.has_open_questions === nextProps.image.has_open_questions &&
         prevProps.image.description === nextProps.image.description &&
         prevProps.image.people.length === nextProps.image.people.length &&
         prevProps.image.thumbnailUrl === nextProps.image.thumbnailUrl &&
         prevProps.image.s3Url === nextProps.image.s3Url &&
         prevProps.translations === nextProps.translations;
});

ImageThumbnail.displayName = 'ImageThumbnail';

// Memoized ImageDisplay component for the view mode - prevents re-render when only people array changes
const ImageDisplay = React.memo(({ 
  s3Url, 
  description, 
  originalFilename, 
  hasOpenQuestions, 
  loadingText 
}) => {
  if (!s3Url) {
    return (
      <div style={{
        width: '100%',
        height: '200px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#333',
        borderRadius: '5px',
        color: '#888'
      }}>
        {loadingText}
      </div>
    );
  }

  return (
    <img
      src={s3Url}
      alt={description || originalFilename}
      data-image-url={s3Url}
      crossOrigin="anonymous"
      style={{
        width: '100%',
        maxHeight: '400px',
        objectFit: 'contain',
        border: hasOpenQuestions ? '3px solid #dc3545' : '1px solid #444',
        borderRadius: '5px',
        transition: 'border-color 0.2s'
      }}
    />
  );
}, (prevProps, nextProps) => {
  // Only re-render if image-specific properties change
  return prevProps.s3Url === nextProps.s3Url &&
         prevProps.description === nextProps.description &&
         prevProps.originalFilename === nextProps.originalFilename &&
         prevProps.hasOpenQuestions === nextProps.hasOpenQuestions;
});

ImageDisplay.displayName = 'ImageDisplay';

// Constants for multi-image upload
const MAX_BATCH_SIZE = 15;
const MAX_FILE_SIZE_MB = 25;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

const ImageGallery = ({ nodes, selectedNode, onPersonSelect, onTaggingModeChange, onViewModeChange, socket }) => {
  const { t } = useTranslation();
  const [images, setImages] = useState([]);
  const [selectedImage, setSelectedImage] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [viewMode, setViewMode] = useState('gallery'); // 'gallery', 'upload', 'view', 'confirm'
  const [description, setDescription] = useState('');
  const [taggingMode, setTaggingMode] = useState(false);
  // Multi-file selection state
  const [selectedFiles, setSelectedFiles] = useState([]); // Array of { file, previewUrl }
  const [dragOver, setDragOver] = useState(false);
  const [editingDescription, setEditingDescription] = useState(false);
  const [descriptionValue, setDescriptionValue] = useState('');
  const [showFamilyGallery, setShowFamilyGallery] = useState(false);
  const [familyGalleryInitialImageId, setFamilyGalleryInitialImageId] = useState(null); // Image ID to open in gallery
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  // Track failed uploads for summary display
  const [failedUploads, setFailedUploads] = useState([]); // Array of { file, error }
  // Track images being processed for thumbnail generation
  const [thumbnailGenerationQueue, setThumbnailGenerationQueue] = useState(new Set());
  const isGeneratingThumbnailsRef = useRef(false);

  // Notify parent of viewMode changes for mobile sidebar height adjustment
  useEffect(() => {
    if (onViewModeChange) {
      onViewModeChange(viewMode);
    }
  }, [viewMode, onViewModeChange]);

  // Debug state changes
  useEffect(() => {
    console.log('ImageGallery: showFamilyGallery state changed to:', showFamilyGallery);
  }, [showFamilyGallery]);

  // Load images from database
  const loadImages = useCallback(async () => {
    try {
      const imagesData = await encryptedApi.loadImages();
      setImages(imagesData);
    } catch (error) {
      console.error('Failed to load images:', error);
    }
  }, []);

  useEffect(() => {
    loadImages();
  }, [loadImages]);

  // Generate thumbnail for an image that doesn't have one (backward fill)
  // NOTE: This requires S3 CORS configuration to work properly
  // For images uploaded before thumbnail feature was implemented
  const generateThumbnailForImage = useCallback(async (image) => {
    // Skip if already in queue or already has thumbnail
    if (thumbnailGenerationQueue.has(image.id) || image.thumbnailS3Key || image.thumbnailUrl) {
      return;
    }

    // Add to queue
    setThumbnailGenerationQueue(prev => new Set([...prev, image.id]));

    try {
      console.log(`[Thumbnail] Attempting to generate thumbnail for image ${image.id}`);
      console.log('[Thumbnail] NOTE: This requires S3 bucket CORS configuration allowing GET requests');
      
      // Wait for the image element to be loaded in DOM
      const waitForImage = () => {
        return new Promise((resolve, reject) => {
          const checkImage = () => {
            const imgElement = document.querySelector(`img[data-image-url="${image.s3Url}"]`);
            if (imgElement && imgElement.complete) {
              resolve(imgElement);
            } else if (imgElement) {
              // Image found but not loaded yet, wait for load event
              imgElement.addEventListener('load', () => resolve(imgElement), { once: true });
              imgElement.addEventListener('error', () => reject(new Error('Image failed to load')), { once: true });
            } else {
              // Image not in DOM yet, retry after a short delay
              setTimeout(checkImage, 100);
            }
          };
          checkImage();
          // Timeout after 10 seconds
          setTimeout(() => reject(new Error('Timeout waiting for image to load')), 10000);
        });
      };
      
      const imgElement = await waitForImage();
      
      // Create a canvas to extract image data
      const canvas = document.createElement('canvas');
      canvas.width = imgElement.naturalWidth;
      canvas.height = imgElement.naturalHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(imgElement, 0, 0);
      
      // Convert canvas to blob
      const imageBlob = await new Promise((resolve, reject) => {
        canvas.toBlob(blob => {
          if (blob) resolve(blob);
          else reject(new Error('Failed to create blob from canvas'));
        }, image.mimeType || 'image/jpeg', 0.95);
      });
      
      const imageFile = new File([imageBlob], image.originalFilename || 'image.jpg', { 
        type: image.mimeType || 'image/jpeg' 
      });
      
      // Generate thumbnail
      const { blob: thumbnailBlob } = await generateThumbnail(imageFile);
      
      // Upload thumbnail and update image record
      const result = await encryptedApi.addThumbnailToImage(
        image.id, 
        thumbnailBlob, 
        image.s3Key
      );
      
      console.log(`[Thumbnail] Successfully created thumbnail for image ${image.id}`);
      
      // Update local state with new thumbnail URL
      setImages(prevImages => prevImages.map(img => 
        img.id === image.id 
          ? { ...img, thumbnailUrl: result.thumbnailUrl, thumbnailS3Key: result.thumbnailS3Key }
          : img
      ));
      
    } catch (error) {
      const isCORSError = error.message.includes('Tainted') || error.message.includes('CORS') || error.message.includes('cross-origin');
      
      if (isCORSError) {
        console.warn(`[Thumbnail] Cannot generate thumbnail due to CORS restrictions. S3 bucket needs CORS configuration to allow GET requests with 'Access-Control-Allow-Origin: *'`);
        console.warn(`[Thumbnail] Image ${image.id} will continue to use full-size image. New uploads will have thumbnails.`);
      } else {
        console.error(`[Thumbnail] Failed to generate thumbnail for image ${image.id}:`, error);
      }
    } finally {
      // Remove from queue
      setThumbnailGenerationQueue(prev => {
        const newSet = new Set(prev);
        newSet.delete(image.id);
        return newSet;
      });
    }
  }, [thumbnailGenerationQueue]);

  // Batch generate thumbnails for images without them
  const batchGenerateMissingThumbnails = useCallback(async (imagesToProcess, batchSize = 3) => {
    if (isGeneratingThumbnailsRef.current) {
      console.log('[Thumbnail] Already generating thumbnails, skipping batch');
      return;
    }

    isGeneratingThumbnailsRef.current = true;

    try {
      for (let i = 0; i < imagesToProcess.length; i += batchSize) {
        const batch = imagesToProcess.slice(i, i + batchSize);
        
        // Process batch in parallel
        await Promise.all(batch.map(img => generateThumbnailForImage(img)));
        
        // Small delay between batches
        if (i + batchSize < imagesToProcess.length) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }
    } finally {
      isGeneratingThumbnailsRef.current = false;
    }
  }, [generateThumbnailForImage]);

  // Callback when full image is loaded (for tracking)
  const handleFullImageLoaded = useCallback((imageId) => {
    console.log(`[Thumbnail] Full image loaded for ${imageId}`);
  }, []);

  // Listen for Socket.IO question toggle events
  useEffect(() => {
    if (!socket) return;

    const handleQuestionToggled = (data) => {
      console.log('[ImageGallery] Received imageQuestionToggled event:', data);
      const { imageId, hasOpenQuestions } = data;
      
      // Update images if this image is in the current set
      setImages(prevImages => {
        const index = prevImages.findIndex(img => img.id === imageId);
        if (index === -1) {
          console.log('[ImageGallery] Image not found in current images');
          return prevImages;
        }
        
        console.log(`[ImageGallery] Updating image at index ${index} with has_open_questions=${hasOpenQuestions}`);
        // Create a new array with the updated image
        const updatedImages = prevImages.map((img, idx) => 
          idx === index 
            ? { ...img, has_open_questions: hasOpenQuestions }
            : img
        );
        
        return updatedImages;
      });

      // Update selected image if it's the one being toggled
      setSelectedImage(prevSelected => {
        if (prevSelected && prevSelected.id === imageId) {
          console.log('[ImageGallery] Updating selected image with has_open_questions=', hasOpenQuestions);
          return { ...prevSelected, has_open_questions: hasOpenQuestions };
        }
        return prevSelected;
      });
    };

    console.log('[ImageGallery] Registering imageQuestionToggled listener');
    socket.on('imageQuestionToggled', handleQuestionToggled);

    return () => {
      console.log('[ImageGallery] Unregistering imageQuestionToggled listener');
      socket.off('imageQuestionToggled', handleQuestionToggled);
    };
  }, [socket]);

  // Notify parent when tagging mode changes
  useEffect(() => {
    if (onTaggingModeChange) {
      onTaggingModeChange(taggingMode && viewMode === 'view');
    }
  }, [taggingMode, viewMode, onTaggingModeChange]);

  // Auto-disable tagging mode when leaving image view or changing images
  useEffect(() => {
    if (viewMode !== 'view') {
      setTaggingMode(false);
    }
  }, [viewMode]);

  // Reset tagging mode when selected image changes
  useEffect(() => {
    setTaggingMode(false);
  }, [selectedImage?.id]);

  // Cleanup preview URLs on unmount
  useEffect(() => {
    return () => {
      // Cleanup all preview URLs
      selectedFiles.forEach(({ previewUrl }) => {
        if (previewUrl) URL.revokeObjectURL(previewUrl);
      });
    };
  }, [selectedFiles]);

  // Keyboard shortcut: Ctrl+Enter to upload when in confirm mode
  useEffect(() => {
    if (viewMode !== 'confirm') return;

    const handleKeyDown = (e) => {
      if (e.ctrlKey && e.key === 'Enter' && !uploadingImage && selectedFiles.length > 0) {
        e.preventDefault();
        confirmUpload();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewMode, uploadingImage, selectedFiles]);

  // Handle image upload (multiple files)
  const handleImageUpload = async (event) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;
    
    await handleFilesSelection(files);
  };

  // Handle multiple file selection (from input or drag-drop)
  // CRITICAL: Must read files into memory immediately on Android to avoid ERR_UPLOAD_FILE_CHANGED
  const handleFilesSelection = async (files) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    const validFiles = [];
    const errors = [];

    // Check batch size limit
    const totalFiles = selectedFiles.length + files.length;
    if (totalFiles > MAX_BATCH_SIZE) {
      alert(t.ui.imageGallery.errors.batchSizeExceeded.replace('{max}', MAX_BATCH_SIZE));
      return;
    }

    for (const file of files) {
      // Validate file type
      if (!allowedTypes.includes(file.type)) {
        errors.push(`${file.name}: ${t.ui.imageGallery.errors.invalidFileType}`);
        continue;
      }

      // Validate file size (25MB max)
      if (file.size > MAX_FILE_SIZE_BYTES) {
        errors.push(`${file.name}: ${t.ui.imageGallery.errors.fileSizeExceeded}`);
        continue;
      }

      try {
        // Read file into memory IMMEDIATELY - Android content URIs become stale quickly
        const arrayBuffer = await file.arrayBuffer();
        const stableBlob = new Blob([arrayBuffer], { type: file.type });
        
        // Create a stable File object from the blob with the original filename
        const stableFile = new File([stableBlob], file.name, { 
          type: file.type,
          lastModified: file.lastModified 
        });

        // Extract metadata description if available (PNG/JPEG)
        let metadataDescription = null;
        try {
          metadataDescription = await extractImageDescription(stableFile);
          if (metadataDescription) {
            console.log(`[Metadata] Extracted description from ${file.name}: "${metadataDescription}"`);
          }
        } catch (metadataError) {
          console.warn(`[Metadata] Could not extract description from ${file.name}:`, metadataError);
        }

        // Create preview URL from the stable blob
        const previewUrl = URL.createObjectURL(stableBlob);
        
        validFiles.push({ 
          file: stableFile, 
          previewUrl,
          metadataDescription // Store extracted description with file
        });
      } catch (error) {
        console.error('Failed to read file:', error);
        errors.push(`${file.name}: Failed to read file`);
      }
    }

    if (errors.length > 0) {
      alert(t.ui.imageGallery.errors.someFilesSkipped + '\n' + errors.join('\n'));
    }

    if (validFiles.length > 0) {
      setSelectedFiles(prev => [...prev, ...validFiles]);
      setViewMode('confirm');
      
      // If first file has metadata description and no description set yet, use it as default
      if (validFiles[0].metadataDescription && !description) {
        setDescription(validFiles[0].metadataDescription);
        console.log(`[Metadata] Using extracted description as default: "${validFiles[0].metadataDescription}"`);
      }
    }
  };

  // Remove a single file from the selection
  const removeFileFromSelection = (indexToRemove) => {
    setSelectedFiles(prev => {
      const newFiles = [...prev];
      // Revoke the preview URL before removing
      if (newFiles[indexToRemove]?.previewUrl) {
        URL.revokeObjectURL(newFiles[indexToRemove].previewUrl);
      }
      newFiles.splice(indexToRemove, 1);
      
      // If no files left, go back to upload view
      if (newFiles.length === 0) {
        setViewMode('upload');
      }
      
      return newFiles;
    });
  };

  // Confirm and upload all selected images
  const confirmUpload = async () => {
    if (selectedFiles.length === 0) return;

    setUploadingImage(true);
    setUploadProgress(0);
    setUploadError(null);
    setRetryCount(0);
    setFailedUploads([]);
    
    const totalFiles = selectedFiles.length;
    let completedFiles = 0;
    const failed = [];
    const successCount = { value: 0 };
    
    // Calculate total size for progress
    const totalSize = selectedFiles.reduce((sum, { file }) => sum + file.size, 0);
    let uploadedSize = 0;

    for (let i = 0; i < selectedFiles.length; i++) {
      const { file, previewUrl } = selectedFiles[i];
      
      try {
        const fileSize = file.size;
        const startProgress = (uploadedSize / totalSize) * 100;
        
        // Generate thumbnail before upload
        let thumbnailBlob = null;
        try {
          const { blob } = await generateThumbnail(file);
          thumbnailBlob = blob;
        } catch (thumbnailError) {
          console.warn(`Failed to generate thumbnail for ${file.name}, uploading without thumbnail:`, thumbnailError);
        }
        
        await encryptedApi.uploadImage(
          file, 
          description,
          'user',
          thumbnailBlob, // Pass thumbnail blob to upload function
          // Progress callback for individual file
          (percentComplete, loaded, total) => {
            const fileProgress = (loaded / total) * (fileSize / totalSize) * 100;
            const overallProgress = startProgress + fileProgress;
            setUploadProgress(Math.min(Math.round(overallProgress), 99));
          }
        );
        
        uploadedSize += fileSize;
        completedFiles++;
        successCount.value++;
        
        // Update progress after each successful upload
        setUploadProgress(Math.round((uploadedSize / totalSize) * 100));
        
      } catch (error) {
        console.error(`Upload error for ${file.name}:`, error);
        failed.push({ 
          file, 
          previewUrl,
          error: error.message || t.ui.imageGallery.errors.unknownError 
        });
      }
    }
    
    setUploadProgress(100);
    
    // Handle results
    if (failed.length > 0) {
      setFailedUploads(failed);
      
      if (successCount.value > 0) {
        // Partial success - some uploaded, some failed
        await loadImages(); // Refresh gallery with successful uploads
        alert(t.ui.imageGallery.success.partialUpload
          .replace('{success}', successCount.value)
          .replace('{total}', totalFiles)
          .replace('{failed}', failed.length));
      } else {
        // All failed
        setUploadError(t.ui.imageGallery.errors.allUploadsFailed);
      }
    } else {
      // All successful
      await loadImages();
      resetUploadState();
      setViewMode('gallery');
      
      if (totalFiles === 1) {
        alert(t.ui.imageGallery.success.uploadSuccess);
      } else {
        alert(t.ui.imageGallery.success.batchUploadSuccess.replace('{count}', totalFiles));
      }
    }
    
    setUploadingImage(false);
  };

  // Reset upload state
  const resetUploadState = () => {
    // Revoke all preview URLs
    selectedFiles.forEach(({ previewUrl }) => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    });
    failedUploads.forEach(({ previewUrl }) => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    });
    
    setSelectedFiles([]);
    setDescription('');
    setUploadProgress(0);
    setUploadError(null);
    setRetryCount(0);
    setFailedUploads([]);
  };

  // Handle drag and drop events
  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFilesSelection(files);
    }
  };

  // Handle image deletion
  const handleDeleteImage = async (imageId) => {
    if (!confirm(t.ui.imageGallery.confirmations.deleteImage)) {
      return;
    }

    try {
      const result = await encryptedApi.deleteImage(imageId);
      if (result.success) {
        await loadImages();
        setSelectedImage(null);
        setViewMode('gallery');
        alert(t.ui.imageGallery.success.deleteSuccess);
      } else {
        alert(t.ui.imageGallery.errors.deleteFailed + (result.error || t.ui.imageGallery.errors.unknownError));
      }
    } catch (error) {
      console.error('Delete error:', error);
      alert(t.ui.imageGallery.errors.deleteFailed + error.message);
    }
  };

  // Handle person tagging in image
  // Optimized to update only the people array without refreshing the entire image
  const handlePersonTag = useCallback(async (personId) => {
    if (!selectedImage || !personId) return;

    // Check if person is already tagged
    const isAlreadyTagged = selectedImage.people?.some(p => p.personId === personId);
    if (isAlreadyTagged) {
      console.log('Person is already tagged in this image');
      return;
    }

    try {
      const result = await encryptedApi.tagPersonInImage(selectedImage.id, personId);
      if (result.success) {
        // Get person name from nodes array for immediate UI update
        const personNode = nodes?.find(n => n.id === personId);
        const personName = personNode?.data?.name || '';
        const personSurname = personNode?.data?.surname || '';
        
        // Optimistically update the selected image's people array
        // without fetching the entire image again (preserves s3Url and prevents reload)
        const newPerson = { 
          personId: personId,
          personName: personName,
          personSurname: personSurname,
          person_name: personName,
          person_surname: personSurname
        };
        
        setSelectedImage(prev => ({
          ...prev,
          people: [...(prev.people || []), newPerson]
        }));
        
        // Update the images array to reflect the new person count
        // without refetching from server (preserves image URLs)
        setImages(prevImages => prevImages.map(img => 
          img.id === selectedImage.id 
            ? { ...img, people: [...(img.people || []), newPerson] }
            : img
        ));
        
        console.log('Person successfully tagged');
      } else {
        if (result.error && result.error.includes('already tagged')) {
          console.log('Person is already tagged in this image');
        } else {
          alert(t.ui.imageGallery.errors.tagFailed + (result.error || t.ui.imageGallery.errors.unknownError));
        }
      }
    } catch (error) {
      console.error('Tagging error:', error);
      if (error.message && error.message.includes('already tagged')) {
        console.log('Person is already tagged in this image');
      } else {
        alert(t.ui.imageGallery.errors.tagFailed + error.message);
      }
    }
  }, [selectedImage, nodes, t.ui.imageGallery.errors.tagFailed, t.ui.imageGallery.errors.unknownError]);

  // Auto-tag when a person is selected in tagging mode
  useEffect(() => {
    if (taggingMode && selectedNode && viewMode === 'view') {
      // Check if this person is already tagged to avoid duplicate tagging
      const isAlreadyTagged = selectedImage?.people?.some(p => p.personId === selectedNode.id);
      
      if (!isAlreadyTagged) {
        // medium delay to make the selection visible before auto-tagging
        const timeoutId = setTimeout(() => {
          handlePersonTag(selectedNode.id);
        }, 500);
        
        return () => clearTimeout(timeoutId);
      }
    }
  }, [selectedNode, taggingMode, viewMode, selectedImage?.people]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle person removal from image
  // Optimized to update only the people array without refreshing the entire image
  const handleRemovePersonTag = useCallback(async (personId) => {
    if (!selectedImage || !personId) return;

    try {
      const result = await encryptedApi.removePersonFromImage(selectedImage.id, personId);
      if (result.success) {
        // Optimistically update the selected image's people array
        // without fetching the entire image again (preserves s3Url and prevents reload)
        setSelectedImage(prev => ({
          ...prev,
          people: (prev.people || []).filter(p => p.personId !== personId)
        }));
        
        // Update the images array to reflect the new person count
        // without refetching from server (preserves image URLs)
        setImages(prevImages => prevImages.map(img => 
          img.id === selectedImage.id 
            ? { ...img, people: (img.people || []).filter(p => p.personId !== personId) }
            : img
        ));
        
        console.log(t.ui.imageGallery.success.personRemoved);
      } else {
        alert(t.ui.imageGallery.errors.removeFailed + (result.error || t.ui.imageGallery.errors.unknownError));
      }
    } catch (error) {
      console.error('Remove error:', error);
      alert(t.ui.imageGallery.errors.removeFailed + error.message);
    }
  }, [selectedImage, t.ui.imageGallery.success.personRemoved, t.ui.imageGallery.errors.removeFailed, t.ui.imageGallery.errors.unknownError]);

  // Description editing functions
  const startEditingDescription = useCallback(() => {
    setDescriptionValue(selectedImage.description || '');
    setEditingDescription(true);
  }, [selectedImage]);

  const cancelEditingDescription = useCallback(() => {
    setEditingDescription(false);
    setDescriptionValue('');
  }, []);

  const saveDescription = useCallback(async () => {
    try {
      const result = await encryptedApi.updateImageDescription(selectedImage.id, descriptionValue);
      if (result.success) {
        // Update the selected image and images array
        const updatedImage = { ...selectedImage, description: descriptionValue };
        setSelectedImage(updatedImage);
        
        // Update the images array
        setImages(images.map(img => 
          img.id === selectedImage.id ? { ...img, description: descriptionValue } : img
        ));
        
        setEditingDescription(false);
      } else {
        throw new Error(result.error || 'Failed to update description');
      }

    } catch (err) {
      console.error('Error updating description:', err);
      alert('Failed to update description: ' + err.message);
    }
  }, [selectedImage, descriptionValue, images]);

  const handleDescriptionChange = useCallback((e) => {
    setDescriptionValue(e.target.value);
  }, []);

  // Handle keyboard shortcuts in description textarea
  const handleDescriptionKeyDown = useCallback((e) => {
    // Ctrl+Enter to save
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      saveDescription();
    }
  }, [saveDescription]);

  // Render gallery view
  const renderGallery = () => (
    <div>
      {/* Gallery buttons - Album and Upload side by side on mobile */}
      <div className="gallery-buttons-container" style={{ marginBottom: '20px', display: 'flex', gap: '10px', flexDirection: 'column' }}>
        <Button
          onClick={() => {
            console.log('Family Gallery button clicked! Current showFamilyGallery state:', showFamilyGallery);
            setShowFamilyGallery(true);
            console.log('Set showFamilyGallery to true');
          }}
          variant="secondary"
          size="medium"
          style={{
            backgroundColor: '#9C27B0'
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#7B1FA2'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#9C27B0'}
        >
          {t.ui.familyGallery.galleryButton}
        </Button>
        
        <Button
          onClick={() => setViewMode('upload')}
          variant="success"
          size="medium"
        >
          {t.ui.imageGallery.gallery.uploadButton}
        </Button>
        
        <Button
          onClick={loadImages}
          className="mobile-hide-refresh-button"
          variant="primary"
          size="medium"
        >
          {t.ui.imageGallery.gallery.refreshButton}
        </Button>
      </div>

      {images.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#cccccc' }}>
          <p>{t.ui.imageGallery.gallery.noImagesTitle}</p>
          <p>{t.ui.imageGallery.gallery.noImagesDescription}</p>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
          gap: '15px',
          width: '100%',
          boxSizing: 'border-box'
        }}>
          {images.map((image, index) => (
            <ImageThumbnail
              key={image.id || `image-${index}`}
              image={image}
              translations={{
                noDescription: t.ui.imageGallery.gallery.noDescription,
                personTagged: t.ui.imageGallery.gallery.personTagged,
                personsTagged: t.ui.imageGallery.gallery.personsTagged
              }}
              onClick={() => {
                setTaggingMode(false); // Reset tagging mode when selecting a new image
                setSelectedImage(image);
                setViewMode('view');
                // Generate thumbnail in background if missing
                if (!image.thumbnailS3Key && !image.thumbnailUrl) {
                  generateThumbnailForImage(image);
                }
              }}
              onLoadFullImage={handleFullImageLoaded}
            />
          ))}
        </div>
      )}
    </div>
  );

  // Render upload view
  const renderUpload = () => (
    <div
      className="upload-container"
      style={{
        position: 'relative',
        minHeight: '400px'
      }}
    >
      {/* Drag overlay */}
      {dragOver && (
        <div className="drag-overlay" style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(76, 175, 80, 0.1)',
          border: '3px dashed #4CAF50',
          borderRadius: '15px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10,
          pointerEvents: 'none'
        }}>
          <div style={{ fontSize: '64px', marginBottom: '20px' }}>📤</div>
          <div style={{ 
            fontSize: '24px', 
            fontWeight: 'bold', 
            color: '#4CAF50',
            textAlign: 'center'
          }}>
            {t.ui.imageGallery.upload.dropHereMessage}
          </div>
        </div>
      )}

      <div style={{ marginBottom: '20px' }}>
        <Button
          onClick={() => setViewMode('gallery')}
          variant="secondary"
          size="medium"
        >
          {t.ui.imageGallery.upload.backButton}
        </Button>
      </div>

      {/* Main Upload Area - Large invisible drop zone */}
      <div
        className="upload-dropzone"
        style={{
          padding: '20px 0',
          marginBottom: '20px',
          cursor: 'pointer',
          minHeight: '300px',
          width: '100%',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center'
        }}
        onClick={() => document.getElementById('file-input').click()}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {/* Visual upload box - mediumer and centered */}
        <div
          className="upload-box"
          style={{
            border: `2px dashed ${dragOver ? '#4CAF50' : '#666'}`,
            borderRadius: '15px',
            padding: '40px',
            textAlign: 'center',
            backgroundColor: '#2a2a2a',
            transition: 'all 0.3s ease',
            width: '100%',
            maxWidth: '400px',
            pointerEvents: 'none' // Prevent this from interfering with drag events
          }}
        >
         
          <div className="upload-title" style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '10px', color: '#ffffff' }}>
            {t.ui.imageGallery.upload.dragDropTitle}
          </div>
          <div className="upload-formats" style={{ fontSize: '14px', color: '#cccccc', marginBottom: '15px' }}>
            {t.ui.imageGallery.upload.supportedFormats}
          </div>
          <div className="upload-button-text" style={{
            display: 'inline-block',
            padding: '12px 24px',
            backgroundColor: '#4CAF50',
            color: 'white',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: 'bold'
          }}>
            {t.ui.imageGallery.upload.selectFileButton}
          </div>
        </div>
      </div>

      {/* Hidden file input - supports multiple files */}
      <input
        id="file-input"
        type="file"
        accept="image/*"
        multiple
        onChange={handleImageUpload}
        style={{ display: 'none' }}
      />

      {/* Instructions */}
      <div className="upload-instructions" style={{ 
        display: 'flex',
        justifyContent: 'center',
        width: '100%'
      }}>
        <div style={{ 
          fontSize: '14px', 
          color: '#cccccc', 
          backgroundColor: '#2a2a2a', 
          padding: '15px',
          borderRadius: '8px',
          border: '1px solid #444',
          width: '100%',
          maxWidth: '400px',
          boxSizing: 'border-box'
        }}>
          <h5 style={{ margin: '0 0 10px 0', color: '#ffffff' }}>{t.ui.imageGallery.upload.howItWorksTitle}</h5>
          <ol style={{ paddingLeft: '20px', margin: 0, lineHeight: '1.6', wordWrap: 'break-word' }}>
            {t.ui.imageGallery.upload.steps.map((step, index) => (
              <li key={index} style={{ marginBottom: '5px' }}>{step}</li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );

  // Render confirmation view for multi-image upload
  const renderConfirm = () => {
    const totalSize = selectedFiles.reduce((sum, { file }) => sum + file.size, 0);
    const totalSizeMB = (totalSize / 1024 / 1024).toFixed(2);
    
    return (
    <div className="confirm-container">
      <div style={{ marginBottom: '20px', display: 'flex', gap: '10px', flexDirection: 'column' }}>
        <Button
          onClick={() => {
            resetUploadState();
            setViewMode('upload');
          }}
          variant="secondary"
          size="medium"
        >
          {t.ui.imageGallery.confirm.backButton}
        </Button>
        <Button
          onClick={resetUploadState}
          variant="danger"
          size="medium"
        >
          {t.ui.imageGallery.confirm.cancelButton}
        </Button>
      </div>

      <h4 className="confirm-title" style={{ margin: '0 0 20px 0', color: '#ffffff' }}>
        {selectedFiles.length === 1 
          ? t.ui.imageGallery.confirm.title
          : (t.ui.imageGallery.confirm.titleMultiple || t.ui.imageGallery.confirm.title).replace('{count}', selectedFiles.length)
        }
      </h4>

      {/* Image Preview Grid */}
      <div className="confirm-preview" style={{ marginBottom: '20px' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: selectedFiles.length === 1 ? '1fr' : 'repeat(auto-fill, minmax(120px, 1fr))',
          gap: '10px',
          width: '100%'
        }}>
          {selectedFiles.map(({ file, previewUrl }, index) => (
            <div 
              key={index}
              style={{
                position: 'relative',
                border: '1px solid #444',
                borderRadius: '8px',
                overflow: 'hidden',
                backgroundColor: '#2a2a2a'
              }}
            >
              <img
                src={previewUrl}
                alt={`${t.ui.imageGallery.confirm.previewAlt} ${index + 1}`}
                style={{
                  width: '100%',
                  height: selectedFiles.length === 1 ? '300px' : '100px',
                  objectFit: 'cover',
                  display: 'block'
                }}
              />
              {/* Remove button */}
              <button
                onClick={() => removeFileFromSelection(index)}
                style={{
                  position: 'absolute',
                  top: '4px',
                  right: '4px',
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  border: 'none',
                  backgroundColor: 'rgba(244, 67, 54, 0.9)',
                  color: 'white',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '14px',
                  fontWeight: 'bold',
                  padding: 0
                }}
                title={t.ui.imageGallery.confirm.removeImage || 'Remove'}
              >
                ✕
              </button>
              {/* Filename overlay for multi-image */}
              {selectedFiles.length > 1 && (
                <div style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  backgroundColor: 'rgba(0,0,0,0.7)',
                  color: '#fff',
                  fontSize: '10px',
                  padding: '4px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  {file.name}
                </div>
              )}
            </div>
          ))}
        </div>
        
        {/* Add more images button */}
        {selectedFiles.length < MAX_BATCH_SIZE && (
          <div style={{ marginTop: '10px', textAlign: 'center' }}>
            <Button
              onClick={() => document.getElementById('file-input-add').click()}
              variant="secondary"
              size="small"
            >
              {t.ui.imageGallery.confirm.addMoreImages || '+ Add more images'}
            </Button>
            <input
              id="file-input-add"
              type="file"
              accept="image/*"
              multiple
              onChange={handleImageUpload}
              style={{ display: 'none' }}
            />
          </div>
        )}
      </div>

      {/* File Information */}
      <div className="confirm-file-info" style={{ 
        marginBottom: '20px', 
        padding: '15px', 
        backgroundColor: '#2a2a2a', 
        borderRadius: '8px',
        border: '1px solid #444'
      }}>
        <h5 style={{ margin: '0 0 10px 0', color: '#ffffff' }}>{t.ui.imageGallery.confirm.fileInfoTitle}</h5>
        <div style={{ fontSize: '14px', lineHeight: '1.5', color: '#cccccc' }}>
          {selectedFiles.length === 1 ? (
            <>
              <div><strong>{t.ui.imageGallery.confirm.filenameLabel}</strong> {selectedFiles[0]?.file.name}</div>
              <div><strong>{t.ui.imageGallery.confirm.sizeLabel}</strong> {(selectedFiles[0]?.file.size / 1024 / 1024).toFixed(2)} MB</div>
              <div><strong>{t.ui.imageGallery.confirm.typeLabel}</strong> {selectedFiles[0]?.file.type}</div>
            </>
          ) : (
            <>
              <div><strong>{t.ui.imageGallery.confirm.imageCountLabel || 'Images:'}</strong> {selectedFiles.length} / {MAX_BATCH_SIZE}</div>
              <div><strong>{t.ui.imageGallery.confirm.totalSizeLabel || 'Total size:'}</strong> {totalSizeMB} MB</div>
            </>
          )}
        </div>
      </div>

      {/* Description Input */}
      <div className="confirm-description-section" style={{ marginBottom: '20px' }}>
        <div style={{
          padding: '15px',
          backgroundColor: '#2a2a2a',
          borderRadius: '8px',
          border: '1px solid #444'
        }}>
          <label style={{ display: 'block', marginBottom: '10px', fontWeight: 'bold', color: '#ffffff', margin: '0 0 10px 0' }}>
            {selectedFiles.length > 1 
              ? (t.ui.imageGallery.confirm.descriptionLabelMultiple || t.ui.imageGallery.confirm.descriptionLabel)
              : t.ui.imageGallery.confirm.descriptionLabel
            }
          </label>
          <DescriptionTextarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t.ui.imageGallery.confirm.descriptionPlaceholder}
            maxLength={1000}
            minHeight="120px"
            showButtons={false}
          />
          <div className="confirm-hint" style={{ fontSize: '12px', color: '#cccccc', marginTop: '8px' }}>
            {selectedFiles.length > 1
              ? (t.ui.imageGallery.confirm.descriptionHintMultiple || t.ui.imageGallery.confirm.descriptionHint)
              : t.ui.imageGallery.confirm.descriptionHint
            }
          </div>
        </div>
      </div>

      {/* Upload Button */}
      <div style={{ display: 'flex', gap: '10px', flexDirection: 'column' }}>
        <Button
          onClick={confirmUpload}
          disabled={uploadingImage}
          variant="success"
          size="large"
        >
          {uploadingImage 
            ? t.ui.imageGallery.confirm.uploadingButton
            : selectedFiles.length > 1
              ? (t.ui.imageGallery.confirm.uploadButtonMultiple || t.ui.imageGallery.confirm.uploadButton).replace('{count}', selectedFiles.length)
              : t.ui.imageGallery.confirm.uploadButton
          }
        </Button>
      </div>

      {uploadingImage && (
        <div style={{ 
          marginTop: '20px', 
          padding: '15px',
          backgroundColor: '#2a2a2a',
          borderRadius: '5px',
          border: '1px solid #444'
        }}>
          <div style={{ fontSize: '14px', color: '#cccccc', marginBottom: '10px' }}>
            {selectedFiles.length > 1
              ? (t.ui.imageGallery.confirm.uploadingMessageMultiple || t.ui.imageGallery.confirm.uploadingMessage)
              : t.ui.imageGallery.confirm.uploadingMessage
            }
          </div>
          
          {/* Progress bar */}
          <div style={{
            width: '100%',
            height: '24px',
            backgroundColor: '#1a1a1a',
            borderRadius: '12px',
            overflow: 'hidden',
            border: '1px solid #444',
            position: 'relative'
          }}>
            <div style={{
              width: `${uploadProgress}%`,
              height: '100%',
              backgroundColor: uploadProgress < 100 ? '#4CAF50' : '#2196F3',
              transition: 'width 0.3s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <span style={{
                color: 'white',
                fontSize: '12px',
                fontWeight: 'bold',
                position: 'absolute',
                width: '100%',
                textAlign: 'center',
                zIndex: 1
              }}>
                {uploadProgress}%
              </span>
            </div>
          </div>
          
          {uploadProgress === 100 && (
            <div style={{ 
              fontSize: '12px', 
              color: '#4CAF50', 
              marginTop: '8px',
              textAlign: 'center'
            }}>
              {t.ui.imageGallery.confirm.processingUpload || 'Processing upload...'}
            </div>
          )}
        </div>
      )}

      {/* Failed uploads summary */}
      {failedUploads.length > 0 && !uploadingImage && (
        <div style={{ 
          marginTop: '20px', 
          padding: '15px',
          backgroundColor: '#2a2a2a',
          borderRadius: '5px',
          border: '1px solid #f44336'
        }}>
          <div style={{ fontSize: '14px', color: '#f44336', marginBottom: '10px' }}>
            <strong>{t.ui.imageGallery.errors.someUploadsFailed || 'Some uploads failed:'}</strong>
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
            gap: '10px',
            marginBottom: '15px'
          }}>
            {failedUploads.map(({ file, previewUrl, error }, index) => (
              <div key={index} style={{
                backgroundColor: '#1a1a1a',
                borderRadius: '4px',
                padding: '8px',
                border: '1px solid #f44336'
              }}>
                <img
                  src={previewUrl}
                  alt={file.name}
                  style={{
                    width: '100%',
                    height: '60px',
                    objectFit: 'cover',
                    borderRadius: '4px',
                    marginBottom: '4px'
                  }}
                />
                <div style={{ 
                  fontSize: '10px', 
                  color: '#cccccc',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  {file.name}
                </div>
                <div style={{ fontSize: '10px', color: '#f44336' }}>
                  {error}
                </div>
              </div>
            ))}
          </div>
          <Button
            onClick={() => {
              // Retry only failed uploads
              setSelectedFiles(failedUploads.map(({ file, previewUrl }) => ({ file, previewUrl })));
              setFailedUploads([]);
              confirmUpload();
            }}
            variant="success"
            size="medium"
          >
            {t.ui.imageGallery.confirm.retryFailed || 'Retry Failed Uploads'}
          </Button>
        </div>
      )}

      {uploadError && !uploadingImage && failedUploads.length === 0 && (
        <div style={{ 
          marginTop: '20px', 
          padding: '15px',
          backgroundColor: '#2a2a2a',
          borderRadius: '5px',
          border: '1px solid #f44336'
        }}>
          <div style={{ fontSize: '14px', color: '#f44336', marginBottom: '10px' }}>
            <strong>{t.ui.imageGallery.errors.uploadFailed}</strong> {uploadError}
          </div>
          <Button
            onClick={confirmUpload}
            variant="success"
            size="medium"
          >
            {t.ui.imageGallery.confirm.retryUpload || 'Retry Upload'}
          </Button>
        </div>
      )}
    </div>
  );
  };
  const renderImageView = () => (
    <div>
      <div style={{ marginBottom: '20px', display: 'flex', gap: '10px', flexDirection: 'column' }}>
        <Button
          onClick={() => setViewMode('gallery')}
          variant="secondary"
          size="medium"
        >
          {t.ui.imageGallery.view.backButton}
        </Button>
        <Button
          onClick={() => setTaggingMode(!taggingMode)}
          variant={taggingMode ? 'danger' : 'success'}
          size="medium"
        >
          {taggingMode ? t.ui.imageGallery.view.cancelTaggingButton : t.ui.imageGallery.view.tagPeopleButton}
        </Button>
        <Button
          onClick={() => {
            console.log('Open in Gallery clicked, image ID:', selectedImage.id);
            setFamilyGalleryInitialImageId(selectedImage.id);
            setShowFamilyGallery(true);
          }}
          variant="secondary"
          size="medium"
          style={{
            backgroundColor: '#9C27B0'
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#7B1FA2'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#9C27B0'}
        >
          {t.ui.imageGallery.view.openInGalleryButton}
        </Button>
        <Button
          onClick={() => handleDeleteImage(selectedImage.id)}
          variant="danger"
          size="medium"
        >
          {t.ui.imageGallery.view.deleteButton}
        </Button>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <ImageDisplay
          s3Url={selectedImage.s3Url}
          description={selectedImage.description}
          originalFilename={selectedImage.originalFilename}
          hasOpenQuestions={selectedImage.has_open_questions}
          loadingText={t.ui.imageGallery.view.loadingImage || 'Loading image...'}
        />
      </div>

      <div className="gallery-description-section" style={{ marginBottom: '20px' }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          marginBottom: '10px' 
        }}>
          <h4 style={{ margin: 0, color: '#ffffff' }}>{t.ui.imageGallery.view.descriptionTitle}</h4>
          {!editingDescription && (
            <Button
              onClick={startEditingDescription}
              variant="success"
              size="medium"
              style={{ width: 'auto', minWidth: '60px' }}
            >
              {selectedImage.description ? t.ui.imageGallery.view.editDescriptionButton : t.ui.imageGallery.view.addDescriptionButton}
            </Button>
          )}
        </div>
        
        {editingDescription ? (
          <>
            <textarea
              value={descriptionValue}
              onChange={handleDescriptionChange}
              placeholder={t.ui.imageGallery.view.descriptionPlaceholder}
              maxLength={1000}
              className="w-full resize-none font-inherit text-sm bg-zinc-800 text-white border border-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              style={{
                paddingLeft: '12px',
                paddingRight: '12px',
                paddingTop: '12px',
                paddingBottom: '12px',
                borderRadius: '8px',
                boxSizing: 'border-box',
                lineHeight: '1.5',
                minHeight: '120px'
              }}
            />
            <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
              <Button
                onClick={saveDescription}
                variant="success"
                size="medium"
                style={{ flex: 1 }}
              >
                {t.ui.imageGallery.view.saveButton}
              </Button>
              <Button
                onClick={cancelEditingDescription}
                variant="danger"
                size="medium"
                style={{ flex: 1 }}
              >
                {t.ui.imageGallery.view.cancelButton}
              </Button>
            </div>
          </>
        ) : (
          <div 
            className="gallery-description-text"
            style={{ 
              fontSize: '14px', 
              lineHeight: '1.5', 
              color: '#cccccc',
              backgroundColor: '#2a2a2a',
              padding: '15px',
              borderRadius: '5px',
              border: '1px solid #444'
            }}
          >
            {selectedImage.description || <em style={{ color: '#888' }}>{t.ui.imageGallery.view.noDescription}</em>}
          </div>
        )}
      </div>

      {selectedImage.people && selectedImage.people.length > 0 && (
        <div>
          <h4 style={{ margin: '0 0 10px 0', color: '#ffffff' }}>{t.ui.imageGallery.view.taggedPeopleTitle} ({selectedImage.people.length})</h4>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', 
            gap: '10px',
            width: '100%',
            boxSizing: 'border-box'
          }}>
            {selectedImage.people.map((person, index) => (
              <div
                key={person.personId || `person-${index}`}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px',
                  backgroundColor: '#2a2a2a',
                  borderRadius: '5px',
                  border: '1px solid #444'
                }}
              >
                <div
                  style={{ cursor: taggingMode ? 'default' : 'pointer', flex: 1, color: '#ffffff' }}
                  onClick={() => !taggingMode && onPersonSelect && onPersonSelect(person.personId)}
                >
                  <strong>
                    {((person.personName || person.person_name || '') + ' ' + (person.personSurname || person.person_surname || '')).trim() || 'Unnamed Person'}
                  </strong>
                </div>
                <Button
                  onClick={() => handleRemovePersonTag(person.personId)}
                  variant="danger"
                  size="medium"
                  style={{ 
                    width: 'auto', 
                    minWidth: '32px',
                    padding: '5px 8px',
                    marginLeft: '8px'
                  }}
                >
                  ✖
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {(!selectedImage.people || selectedImage.people.length === 0) && (
        <div style={{ textAlign: 'center', padding: '20px', color: '#cccccc' }}>
          <p>{t.ui.imageGallery.view.noTaggedPeople}</p>
          <p>{t.ui.imageGallery.view.tagPeoplePrompt}</p>
        </div>
      )}
    </div>
  );

  return (
    <div style={{
      backgroundColor: '#1a1a1a',
      height: '100%',
      overflowY: 'auto',
      overflowX: 'hidden',
      boxSizing: 'border-box',
      color: '#ffffff',
      display: 'flex',
      flexDirection: 'column',
      minHeight: 0 // Allows flex shrinking
    }}>
      <div className="mobile-hide-gallery-header" style={{ padding: '20px', flexShrink: 0 }}>
        <h3 style={{ margin: '0 0 20px 0', color: '#ffffff' }}>
          {t.ui.imageGallery.title}
        </h3>
      </div>

      <div className="gallery-content" style={{ 
        flex: 1, 
        padding: '0 20px 20px 20px', 
        overflowY: 'auto', 
        overflowX: 'hidden',
        minHeight: 0 // Allows flex shrinking
      }}>
        {viewMode === 'gallery' && renderGallery()}
        {viewMode === 'upload' && renderUpload()}
        {viewMode === 'confirm' && renderConfirm()}
        {viewMode === 'view' && selectedImage && renderImageView()}
      </div>

      {/* Family Gallery Slideshow */}
      {showFamilyGallery && (
        <>
          {console.log('Rendering PictureSlideshow in family mode, showFamilyGallery:', showFamilyGallery, 'initialImageId:', familyGalleryInitialImageId)}
          <PictureSlideshow
            mode="family"
            onClose={() => {
              console.log('Closing family gallery');
              setShowFamilyGallery(false);
              setFamilyGalleryInitialImageId(null); // Reset initial image ID when closing
            }}
            onPersonSelect={onPersonSelect}
            socket={socket}
            initialImageId={familyGalleryInitialImageId}
          />
        </>
      )}
    </div>
  );
};

export default ImageGallery;
