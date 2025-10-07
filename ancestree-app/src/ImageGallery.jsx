import React, { useState, useEffect, useCallback } from 'react';
import { api } from './api';
import { appConfig } from './config';
import PictureSlideshow from './PictureSlideshow';

const ImageGallery = ({ selectedNode, onPersonSelect, onTaggingModeChange }) => {
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

  // Debug state changes
  useEffect(() => {
    console.log('ImageGallery: showFamilyGallery state changed to:', showFamilyGallery);
  }, [showFamilyGallery]);

  // Load images from database
  const loadImages = useCallback(async () => {
    try {
      const imagesData = await api.loadImages();
      setImages(imagesData);
    } catch (error) {
      console.error('Failed to load images:', error);
    }
  }, []);

  useEffect(() => {
    loadImages();
  }, [loadImages]);

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
    try {
      const result = await api.uploadImage(selectedFile, description, 'user');
      if (result.success) {
        await loadImages(); // Refresh the gallery
        resetUploadState();
        setViewMode('gallery');
        alert(appConfig.ui.imageGallery.success.uploadSuccess);
      } else {
        alert(appConfig.ui.imageGallery.errors.uploadFailed + (result.error || appConfig.ui.imageGallery.errors.unknownError));
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert(appConfig.ui.imageGallery.errors.uploadFailed + error.message);
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
      const result = await api.deleteImage(imageId);
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
      const result = await api.tagPersonInImage(selectedImage.id, personId);
      if (result.success) {
        // Refresh the selected image data
        const updatedImage = await api.getImage(selectedImage.id);
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
        // Small delay to make the selection visible before auto-tagging
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
      const result = await api.removePersonFromImage(selectedImage.id, personId);
      if (result.success) {
        // Refresh the selected image data and the gallery
        const updatedImage = await api.getImage(selectedImage.id);
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
      const result = await api.updateImageDescription(selectedImage.id, descriptionValue);
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

  // Render gallery view
  const renderGallery = () => (
    <div>
      {/* Family Gallery Button on top */}
      <div style={{ marginBottom: '10px' }}>
        <button
          onClick={() => {
            console.log('Family Gallery button clicked! Current showFamilyGallery state:', showFamilyGallery);
            setShowFamilyGallery(true);
            console.log('Set showFamilyGallery to true');
          }}
          style={{
            padding: '12px 20px',
            backgroundColor: '#9C27B0',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '14px',
            width: '100%'
          }}
        >
          {appConfig.ui.familyGallery.galleryButton}
        </button>
      </div>

      {/* Upload and Refresh buttons below */}
      <div style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
        <button
          onClick={() => setViewMode('upload')}
          style={{
            padding: '12px 20px',
            backgroundColor: '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          {appConfig.ui.imageGallery.gallery.uploadButton}
        </button>
        <button
          onClick={loadImages}
          style={{
            padding: '12px 20px',
            backgroundColor: '#2196F3',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          {appConfig.ui.imageGallery.gallery.refreshButton}
        </button>
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
            <div
              key={image.id || `image-${index}`}
              style={{
                border: '1px solid #444',
                borderRadius: '8px',
                overflow: 'hidden',
                cursor: 'pointer',
                backgroundColor: '#2a2a2a',
                transition: 'transform 0.2s'
              }}
              onClick={() => {
                setSelectedImage(image);
                setViewMode('view');
              }}
              onMouseEnter={(e) => e.target.style.transform = 'scale(1.02)'}
              onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
            >
              <img
                src={image.s3Url}
                alt={image.description || image.originalFilename}
                style={{
                  width: '100%',
                  height: '150px',
                  objectFit: 'cover'
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
          ))}
        </div>
      )}
    </div>
  );

  // Render upload view
  const renderUpload = () => (
    <div
      style={{
        position: 'relative',
        minHeight: '400px'
      }}
    >
      {/* Drag overlay */}
      {dragOver && (
        <div style={{
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
        <button
          onClick={() => setViewMode('gallery')}
          style={{
            padding: '8px 15px',
            backgroundColor: '#666',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          {appConfig.ui.imageGallery.upload.backButton}
        </button>
      </div>

      {/* Main Upload Area - Large invisible drop zone */}
      <div
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
        {/* Visual upload box - smaller and centered */}
        <div
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
          <div style={{ fontSize: '48px', marginBottom: '10px' }}>
            📤
          </div>
          <div style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '10px', color: '#ffffff' }}>
            {appConfig.ui.imageGallery.upload.dragDropTitle}
          </div>
          <div style={{ fontSize: '14px', color: '#cccccc', marginBottom: '15px' }}>
            {appConfig.ui.imageGallery.upload.supportedFormats}
          </div>
          <div style={{
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
      <div style={{ 
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
    <div>
      <div style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
        <button
          onClick={() => {
            resetUploadState();
            setViewMode('upload');
          }}
          style={{
            padding: '8px 15px',
            backgroundColor: '#666',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          {appConfig.ui.imageGallery.confirm.backButton}
        </button>
        <button
          onClick={resetUploadState}
          style={{
            padding: '8px 15px',
            backgroundColor: '#f44336',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          {appConfig.ui.imageGallery.confirm.cancelButton}
        </button>
      </div>

      <h4 style={{ margin: '0 0 20px 0', color: '#ffffff' }}>
        {appConfig.ui.imageGallery.confirm.title}
      </h4>

      {/* Image Preview */}
      <div style={{ marginBottom: '20px' }}>
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
      <div style={{ 
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
      <div style={{ marginBottom: '30px' }}>
        <label style={{ display: 'block', marginBottom: '10px', fontWeight: 'bold', color: '#ffffff' }}>
          {appConfig.ui.imageGallery.confirm.descriptionLabel}
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={appConfig.ui.imageGallery.confirm.descriptionPlaceholder}
          style={{
            width: '100%',
            height: '100px',
            padding: '10px',
            border: '1px solid #444',
            borderRadius: '8px',
            fontSize: '14px',
            resize: 'vertical',
            fontFamily: 'inherit',
            backgroundColor: '#2a2a2a',
            color: '#ffffff'
          }}
        />
        <div style={{ fontSize: '12px', color: '#cccccc', marginTop: '5px' }}>
          {appConfig.ui.imageGallery.confirm.descriptionHint}
        </div>
      </div>

      {/* Upload Button */}
      <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
        <button
          onClick={confirmUpload}
          disabled={uploadingImage}
          style={{
            padding: '15px 30px',
            backgroundColor: uploadingImage ? '#ccc' : '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: uploadingImage ? 'not-allowed' : 'pointer',
            fontSize: '16px',
            fontWeight: 'bold',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}
        >
          {uploadingImage ? (
            <>
              <span>⏳</span>
              {appConfig.ui.imageGallery.confirm.uploadingButton}
            </>
          ) : (
            <>
              <span>📤</span>
              {appConfig.ui.imageGallery.confirm.uploadButton}
            </>
          )}
        </button>
      </div>

      {uploadingImage && (
        <div style={{ 
          marginTop: '20px', 
          textAlign: 'center', 
          padding: '15px',
          backgroundColor: '#2a2a2a',
          borderRadius: '5px',
          border: '1px solid #444'
        }}>
          <div style={{ fontSize: '14px', color: '#cccccc' }}>
            {appConfig.ui.imageGallery.confirm.uploadingMessage}
          </div>
        </div>
      )}
    </div>
  );
  const renderImageView = () => (
    <div>
      <div style={{ marginBottom: '20px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <button
          onClick={() => setViewMode('gallery')}
          style={{
            padding: '8px 15px',
            backgroundColor: '#666',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          {appConfig.ui.imageGallery.view.backButton}
        </button>
        <button
          onClick={() => setTaggingMode(!taggingMode)}
          style={{
            padding: '8px 15px',
            backgroundColor: taggingMode ? '#FF5722' : '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          {taggingMode ? appConfig.ui.imageGallery.view.cancelTaggingButton : appConfig.ui.imageGallery.view.tagPeopleButton}
        </button>
        <button
          onClick={() => handleDeleteImage(selectedImage.id)}
          style={{
            padding: '8px 15px',
            backgroundColor: '#f44336',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          {appConfig.ui.imageGallery.view.deleteButton}
        </button>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <img
          src={selectedImage.s3Url}
          alt={selectedImage.description || selectedImage.originalFilename}
          style={{
            width: '100%',
            maxHeight: '400px',
            objectFit: 'contain',
            border: '1px solid #444',
            borderRadius: '5px'
          }}
        />
      </div>

      {selectedImage.description || !editingDescription ? (
        <div style={{ marginBottom: '20px' }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            marginBottom: '10px' 
          }}>
            <h4 style={{ margin: 0, color: '#ffffff' }}>{appConfig.ui.imageGallery.view.descriptionTitle}</h4>
            {!editingDescription && (
              <button
                onClick={startEditingDescription}
                style={{
                  padding: '4px 8px',
                  backgroundColor: '#4CAF50',
                  color: 'white',
                  border: 'none',
                  borderRadius: '3px',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
              >
                Edit
              </button>
            )}
          </div>
          
          {editingDescription ? (
            <div>
              <textarea
                value={descriptionValue}
                onChange={handleDescriptionChange}
                placeholder="Enter image description..."
                style={{
                  width: '100%',
                  height: '80px',
                  padding: '8px',
                  border: '1px solid #444',
                  borderRadius: '4px',
                  backgroundColor: '#2a2a2a',
                  color: '#ffffff',
                  fontSize: '14px',
                  resize: 'vertical',
                  fontFamily: 'inherit'
                }}
              />
              <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                <button
                  onClick={saveDescription}
                  style={{
                    padding: '6px 12px',
                    backgroundColor: '#4CAF50',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '12px'
                  }}
                >
                  Save
                </button>
                <button
                  onClick={cancelEditingDescription}
                  style={{
                    padding: '6px 12px',
                    backgroundColor: '#666',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '12px'
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div style={{ 
              fontSize: '14px', 
              lineHeight: '1.5', 
              color: '#cccccc',
              backgroundColor: '#2a2a2a',
              padding: '15px',
              borderRadius: '5px',
              border: '1px solid #444'
            }}>
              {selectedImage.description || <em style={{ color: '#888' }}>No description available</em>}
            </div>
          )}
        </div>
      ) : (
        <div style={{ marginBottom: '20px' }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            marginBottom: '10px' 
          }}>
            <h4 style={{ margin: 0, color: '#ffffff' }}>{appConfig.ui.imageGallery.view.descriptionTitle}</h4>
            <button
              onClick={startEditingDescription}
              style={{
                padding: '4px 8px',
                backgroundColor: '#4CAF50',
                color: 'white',
                border: 'none',
                borderRadius: '3px',
                cursor: 'pointer',
                fontSize: '12px'
              }}
            >
              Add Description
            </button>
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
                <button
                  onClick={() => handleRemovePersonTag(person.personId)}
                  style={{
                    padding: '5px 8px',
                    backgroundColor: '#f44336',
                    color: 'white',
                    border: 'none',
                    borderRadius: '3px',
                    cursor: 'pointer',
                    fontSize: '11px',
                    marginLeft: '8px'
                  }}
                >
                  ✖
                </button>
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
      <div style={{ padding: '20px', flexShrink: 0 }}>
        <h3 style={{ margin: '0 0 20px 0', color: '#ffffff' }}>
          {appConfig.ui.imageGallery.title}
        </h3>
      </div>

      <div style={{ 
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
          />
        </>
      )}
    </div>
  );
};

export default ImageGallery;
