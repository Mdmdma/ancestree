import { encryptedApi } from './encryptedApi';
import React, { useState, useEffect, useCallback } from 'react';
import { api } from './api';
import { appConfig } from './config';
import PictureSlideshow from './PictureSlideshow';
import DescriptionTextarea from './components/DescriptionTextarea';
import Button from './components/Button';

// Memoized ImageThumbnail component to prevent unnecessary re-renders
const ImageThumbnail = React.memo(({ image, onClick }) => {
  return (
    <div
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
        src={image.s3Url}
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
            {image.description.length > 80 
              ? image.description.substring(0, 80) + '...'
              : image.description
            }
          </div>
        ) : (
          <div style={{ fontSize: '12px', color: '#888', fontStyle: 'italic' }}>
            {appConfig.ui.imageGallery.gallery.noDescription}
          </div>
        )}
        <div style={{ fontSize: '10px', color: '#aaaaaa' }}>
          {image.people.length} {image.people.length !== 1 ? appConfig.ui.imageGallery.gallery.personsTagged : appConfig.ui.imageGallery.gallery.personTagged}
        </div>
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison function - only re-render if these properties change
  return prevProps.image.id === nextProps.image.id &&
         prevProps.image.has_open_questions === nextProps.image.has_open_questions &&
         prevProps.image.description === nextProps.image.description &&
         prevProps.image.people.length === nextProps.image.people.length;
});

ImageThumbnail.displayName = 'ImageThumbnail';

const ImageGallery = ({ selectedNode, onPersonSelect, onTaggingModeChange, onViewModeChange, socket }) => {
  const [images, setImages] = useState([]);
  const [selectedImage, setSelectedImage] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [viewMode, setViewMode] = useState('gallery'); // 'gallery', 'upload', 'view', 'confirm'
  const [description, setDescription] = useState('');
  const [taggingMode, setTaggingMode] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [editingDescription, setEditingDescription] = useState(false);
  const [descriptionValue, setDescriptionValue] = useState('');
  const [showFamilyGallery, setShowFamilyGallery] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);

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

  // Cleanup preview URLs on unmount
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  // Handle image upload
  const handleImageUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    handleFileSelection(file);
  };

  // Handle file selection (from input or drag-drop)
  const handleFileSelection = (file) => {
    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      alert(appConfig.ui.imageGallery.errors.invalidFileType);
      return;
    }

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      alert(appConfig.ui.imageGallery.errors.fileSizeExceeded);
      return;
    }

    // Create preview URL
    const url = URL.createObjectURL(file);
    setSelectedFile(file);
    setPreviewUrl(url);
    setViewMode('confirm');
  };

  // Confirm and upload the image
  const confirmUpload = async () => {
    if (!selectedFile) return;

    setUploadingImage(true);
    setUploadProgress(0);
    setUploadError(null);
    setRetryCount(0);
    
    try {
      const result = await encryptedApi.uploadImage(
        selectedFile, 
        description, 
        'user',
        // Progress callback
        (percentComplete, loaded, total) => {
          setUploadProgress(Math.round(percentComplete));
        }
      );
      
      if (result.success) {
        await loadImages(); // Refresh the gallery
        resetUploadState();
        setViewMode('gallery');
        alert(appConfig.ui.imageGallery.success.uploadSuccess);
      } else {
        const errorMessage = result.error || appConfig.ui.imageGallery.errors.unknownError;
        setUploadError(errorMessage);
        alert(appConfig.ui.imageGallery.errors.uploadFailed + errorMessage);
      }
    } catch (error) {
      console.error('Upload error:', error);
      const errorMessage = error.message || appConfig.ui.imageGallery.errors.unknownError;
      setUploadError(errorMessage);
      
      // Provide more user-friendly error messages
      let displayMessage = errorMessage;
      if (errorMessage.includes('Network error') || errorMessage.includes('network')) {
        displayMessage = 'Network error. Please check your internet connection and try again.';
      } else if (errorMessage.includes('timed out') || errorMessage.includes('timeout')) {
        displayMessage = 'Upload timed out. This may be due to a slow connection or large file size. Please try again.';
      } else if (errorMessage.includes('Invalid file type')) {
        displayMessage = 'Invalid file type. Please select a JPEG, PNG, GIF, or WebP image.';
      } else if (errorMessage.includes('File too large')) {
        displayMessage = 'File is too large. Maximum file size is 10MB.';
      }
      
      alert(appConfig.ui.imageGallery.errors.uploadFailed + displayMessage);
    } finally {
      setUploadingImage(false);
    }
  };

  // Reset upload state
  const resetUploadState = () => {
    setSelectedFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    setDescription('');
    setUploadProgress(0);
    setUploadError(null);
    setRetryCount(0);
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
      handleFileSelection(files[0]); // Only handle the first file
    }
  };

  // Handle image deletion
  const handleDeleteImage = async (imageId) => {
    if (!confirm(appConfig.ui.imageGallery.confirmations.deleteImage)) {
      return;
    }

    try {
      const result = await encryptedApi.deleteImage(imageId);
      if (result.success) {
        await loadImages();
        setSelectedImage(null);
        setViewMode('gallery');
        alert(appConfig.ui.imageGallery.success.deleteSuccess);
      } else {
        alert(appConfig.ui.imageGallery.errors.deleteFailed + (result.error || appConfig.ui.imageGallery.errors.unknownError));
      }
    } catch (error) {
      console.error('Delete error:', error);
      alert(appConfig.ui.imageGallery.errors.deleteFailed + error.message);
    }
  };

  // Handle person tagging in image
  const handlePersonTag = async (personId) => {
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
        // Refresh the selected image data
        const updatedImage = await encryptedApi.getImage(selectedImage.id);
        setSelectedImage(updatedImage);
        
        // Also refresh the main gallery to update the person count
        await loadImages();
        
        console.log('Person successfully tagged');
      } else {
        if (result.error && result.error.includes('already tagged')) {
          console.log('Person is already tagged in this image');
        } else {
          alert(appConfig.ui.imageGallery.errors.tagFailed + (result.error || appConfig.ui.imageGallery.errors.unknownError));
        }
      }
    } catch (error) {
      console.error('Tagging error:', error);
      if (error.message && error.message.includes('already tagged')) {
        console.log('Person is already tagged in this image');
      } else {
        alert(appConfig.ui.imageGallery.errors.tagFailed + error.message);
      }
    }
  };

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
  const handleRemovePersonTag = async (personId) => {
    if (!selectedImage || !personId) return;

    try {
      const result = await encryptedApi.removePersonFromImage(selectedImage.id, personId);
      if (result.success) {
        // Refresh the selected image data and the gallery
        const updatedImage = await encryptedApi.getImage(selectedImage.id);
        setSelectedImage(updatedImage);
        
        // Also refresh the main gallery to update the person count
        await loadImages();
        
        console.log(appConfig.ui.imageGallery.success.personRemoved);
      } else {
        alert(appConfig.ui.imageGallery.errors.removeFailed + (result.error || appConfig.ui.imageGallery.errors.unknownError));
      }
    } catch (error) {
      console.error('Remove error:', error);
      alert(appConfig.ui.imageGallery.errors.removeFailed + error.message);
    }
  };

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
          {appConfig.ui.familyGallery.galleryButton}
        </Button>
        
        <Button
          onClick={() => setViewMode('upload')}
          variant="success"
          size="medium"
        >
          {appConfig.ui.imageGallery.gallery.uploadButton}
        </Button>
        
        <Button
          onClick={loadImages}
          className="mobile-hide-refresh-button"
          variant="primary"
          size="medium"
        >
          {appConfig.ui.imageGallery.gallery.refreshButton}
        </Button>
      </div>

      {images.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#cccccc' }}>
          <p>{appConfig.ui.imageGallery.gallery.noImagesTitle}</p>
          <p>{appConfig.ui.imageGallery.gallery.noImagesDescription}</p>
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
              onClick={() => {
                setSelectedImage(image);
                setViewMode('view');
              }}
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
            {appConfig.ui.imageGallery.upload.dropHereMessage}
          </div>
        </div>
      )}

      <div style={{ marginBottom: '20px' }}>
        <Button
          onClick={() => setViewMode('gallery')}
          variant="secondary"
          size="medium"
        >
          {appConfig.ui.imageGallery.upload.backButton}
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
          <div className="upload-icon" style={{ fontSize: '48px', marginBottom: '10px' }}>
            📤
          </div>
          <div className="upload-title" style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '10px', color: '#ffffff' }}>
            {appConfig.ui.imageGallery.upload.dragDropTitle}
          </div>
          <div className="upload-formats" style={{ fontSize: '14px', color: '#cccccc', marginBottom: '15px' }}>
            {appConfig.ui.imageGallery.upload.supportedFormats}
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
            {appConfig.ui.imageGallery.upload.selectFileButton}
          </div>
        </div>
      </div>

      {/* Hidden file input */}
      <input
        id="file-input"
        type="file"
        accept="image/*"
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
          <h5 style={{ margin: '0 0 10px 0', color: '#ffffff' }}>{appConfig.ui.imageGallery.upload.howItWorksTitle}</h5>
          <ol style={{ paddingLeft: '20px', margin: 0, lineHeight: '1.6', wordWrap: 'break-word' }}>
            {appConfig.ui.imageGallery.upload.steps.map((step, index) => (
              <li key={index} style={{ marginBottom: '5px' }}>{step}</li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );

  // Render confirmation view
  const renderConfirm = () => (
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
          {appConfig.ui.imageGallery.confirm.backButton}
        </Button>
        <Button
          onClick={resetUploadState}
          variant="danger"
          size="medium"
        >
          {appConfig.ui.imageGallery.confirm.cancelButton}
        </Button>
      </div>

      <h4 className="confirm-title" style={{ margin: '0 0 20px 0', color: '#ffffff' }}>
        {appConfig.ui.imageGallery.confirm.title}
      </h4>

      {/* Image Preview */}
      <div className="confirm-preview" style={{ marginBottom: '20px' }}>
        <img
          src={previewUrl}
          alt={appConfig.ui.imageGallery.confirm.previewAlt}
          style={{
            width: '100%',
            maxHeight: '300px',
            objectFit: 'contain',
            border: '1px solid #444',
            borderRadius: '8px',
            backgroundColor: '#2a2a2a'
          }}
        />
      </div>

      {/* File Information */}
      <div className="confirm-file-info" style={{ 
        marginBottom: '20px', 
        padding: '15px', 
        backgroundColor: '#2a2a2a', 
        borderRadius: '8px',
        border: '1px solid #444'
      }}>
        <h5 style={{ margin: '0 0 10px 0', color: '#ffffff' }}>{appConfig.ui.imageGallery.confirm.fileInfoTitle}</h5>
        <div style={{ fontSize: '14px', lineHeight: '1.5', color: '#cccccc' }}>
          <div><strong>{appConfig.ui.imageGallery.confirm.filenameLabel}</strong> {selectedFile?.name}</div>
          <div><strong>{appConfig.ui.imageGallery.confirm.sizeLabel}</strong> {selectedFile ? (selectedFile.size / 1024 / 1024).toFixed(2) : '0'} MB</div>
          <div><strong>{appConfig.ui.imageGallery.confirm.typeLabel}</strong> {selectedFile?.type}</div>
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
            {appConfig.ui.imageGallery.confirm.descriptionLabel}
          </label>
          <DescriptionTextarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={appConfig.ui.imageGallery.confirm.descriptionPlaceholder}
            maxLength={1000}
            minHeight="120px"
            showButtons={false}
          />
          <div className="confirm-hint" style={{ fontSize: '12px', color: '#cccccc', marginTop: '8px' }}>
            {appConfig.ui.imageGallery.confirm.descriptionHint}
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
          icon={uploadingImage ? '⏳' : '📤'}
        >
          {uploadingImage 
            ? appConfig.ui.imageGallery.confirm.uploadingButton
            : appConfig.ui.imageGallery.confirm.uploadButton
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
            {appConfig.ui.imageGallery.confirm.uploadingMessage}
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
              Processing upload...
            </div>
          )}
        </div>
      )}

      {uploadError && !uploadingImage && (
        <div style={{ 
          marginTop: '20px', 
          padding: '15px',
          backgroundColor: '#2a2a2a',
          borderRadius: '5px',
          border: '1px solid #f44336'
        }}>
          <div style={{ fontSize: '14px', color: '#f44336', marginBottom: '10px' }}>
            <strong>Upload Failed:</strong> {uploadError}
          </div>
          <Button
            onClick={confirmUpload}
            variant="success"
            size="medium"
          >
            Retry Upload
          </Button>
        </div>
      )}
    </div>
  );
  const renderImageView = () => (
    <div>
      <div style={{ marginBottom: '20px', display: 'flex', gap: '10px', flexDirection: 'column' }}>
        <Button
          onClick={() => setViewMode('gallery')}
          variant="secondary"
          size="medium"
        >
          {appConfig.ui.imageGallery.view.backButton}
        </Button>
        <Button
          onClick={() => setTaggingMode(!taggingMode)}
          variant={taggingMode ? 'danger' : 'success'}
          size="medium"
        >
          {taggingMode ? appConfig.ui.imageGallery.view.cancelTaggingButton : appConfig.ui.imageGallery.view.tagPeopleButton}
        </Button>
        <Button
          onClick={() => handleDeleteImage(selectedImage.id)}
          variant="danger"
          size="medium"
        >
          {appConfig.ui.imageGallery.view.deleteButton}
        </Button>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <img
          src={selectedImage.s3Url}
          alt={selectedImage.description || selectedImage.originalFilename}
          style={{
            width: '100%',
            maxHeight: '400px',
            objectFit: 'contain',
            border: selectedImage.has_open_questions ? '3px solid #dc3545' : '1px solid #444',
            borderRadius: '5px',
            transition: 'border-color 0.2s'
          }}
        />
      </div>

      {selectedImage.description || !editingDescription ? (
        <div className="gallery-description-section" style={{ marginBottom: '20px' }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            marginBottom: '10px' 
          }}>
            <h4 style={{ margin: 0, color: '#ffffff' }}>{appConfig.ui.imageGallery.view.descriptionTitle}</h4>
            {!editingDescription && (
              <Button
                onClick={startEditingDescription}
                variant="success"
                size="medium"
                style={{ width: 'auto', minWidth: '60px' }}
              >
                Edit
              </Button>
            )}
          </div>
          
          {editingDescription ? (
            <DescriptionTextarea
              value={descriptionValue}
              onChange={handleDescriptionChange}
              onSave={saveDescription}
              onCancel={cancelEditingDescription}
              placeholder="Enter image description..."
              maxLength={1000}
              minHeight="120px"
              saveButtonText="Save"
              cancelButtonText="Cancel"
            />
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
              {selectedImage.description || <em style={{ color: '#888' }}>No description available</em>}
            </div>
          )}
        </div>
      ) : (
        <div className="gallery-description-section" style={{ marginBottom: '20px' }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            marginBottom: '10px' 
          }}>
            <h4 style={{ margin: 0, color: '#ffffff' }}>{appConfig.ui.imageGallery.view.descriptionTitle}</h4>
            <Button
              onClick={startEditingDescription}
              variant="success"
              size="medium"
              style={{ width: 'auto', minWidth: '120px' }}
            >
              Add Description
            </Button>
          </div>
        </div>
      )}

      {selectedImage.people && selectedImage.people.length > 0 && (
        <div>
          <h4 style={{ margin: '0 0 10px 0', color: '#ffffff' }}>{appConfig.ui.imageGallery.view.taggedPeopleTitle} ({selectedImage.people.length})</h4>
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
          <p>{appConfig.ui.imageGallery.view.noTaggedPeople}</p>
          <p>{appConfig.ui.imageGallery.view.tagPeoplePrompt}</p>
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
          {appConfig.ui.imageGallery.title}
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
          {console.log('Rendering PictureSlideshow in family mode, showFamilyGallery:', showFamilyGallery)}
          <PictureSlideshow
            mode="family"
            onClose={() => {
              console.log('Closing family gallery');
              setShowFamilyGallery(false);
            }}
            onPersonSelect={onPersonSelect}
            socket={socket}
          />
        </>
      )}
    </div>
  );
};

export default ImageGallery;
