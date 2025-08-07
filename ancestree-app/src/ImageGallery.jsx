import React, { useState, useEffect, useCallback } from 'react';
import { api } from './api';

const ImageGallery = ({ nodes, selectedNode, onPersonSelect }) => {
  const [images, setImages] = useState([]);
  const [selectedImage, setSelectedImage] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [viewMode, setViewMode] = useState('gallery'); // 'gallery', 'upload', 'view'
  const [description, setDescription] = useState('');
  const [taggingMode, setTaggingMode] = useState(false);
  const [showTaggingInstructions, setShowTaggingInstructions] = useState(false);

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

  // Handle image upload
  const handleImageUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      alert('Please select a valid image file (JPEG, PNG, GIF, or WebP)');
      return;
    }

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      alert('File size must be less than 10MB');
      return;
    }

    setUploadingImage(true);
    try {
      const result = await api.uploadImage(file, description, 'user');
      if (result.success) {
        await loadImages(); // Refresh the gallery
        setViewMode('gallery');
        setDescription('');
        alert('Image uploaded successfully!');
      } else {
        alert('Failed to upload image: ' + (result.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert('Failed to upload image: ' + error.message);
    } finally {
      setUploadingImage(false);
    }
  };

  // Handle image deletion
  const handleDeleteImage = async (imageId) => {
    if (!confirm('Are you sure you want to delete this image? This action cannot be undone.')) {
      return;
    }

    try {
      const result = await api.deleteImage(imageId);
      if (result.success) {
        await loadImages();
        setSelectedImage(null);
        setViewMode('gallery');
        alert('Image deleted successfully!');
      } else {
        alert('Failed to delete image: ' + (result.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Delete error:', error);
      alert('Failed to delete image: ' + error.message);
    }
  };

  // Handle person tagging in image
  const handlePersonTag = async (personId) => {
    if (!selectedImage || !personId) return;

    try {
      const result = await api.tagPersonInImage(selectedImage.id, personId);
      if (result.success) {
        // Refresh the selected image data
        const updatedImage = await api.getImage(selectedImage.id);
        setSelectedImage(updatedImage);
        alert(`${nodes.find(n => n.id === personId)?.data.name || 'Person'} tagged in image!`);
      } else {
        alert('Failed to tag person: ' + (result.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Tagging error:', error);
      alert('Failed to tag person: ' + error.message);
    }
  };

  // Handle person removal from image
  const handleRemovePersonTag = async (personId) => {
    if (!selectedImage || !personId) return;

    try {
      const result = await api.removePersonFromImage(selectedImage.id, personId);
      if (result.success) {
        // Refresh the selected image data
        const updatedImage = await api.getImage(selectedImage.id);
        setSelectedImage(updatedImage);
        alert('Person removed from image!');
      } else {
        alert('Failed to remove person: ' + (result.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Remove error:', error);
      alert('Failed to remove person: ' + error.message);
    }
  };

  // Render gallery view
  const renderGallery = () => (
    <div>
      <div style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
        <button
          onClick={() => setViewMode('upload')}
          style={{
            padding: '12px 20px',
            backgroundColor: '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          📤 Upload Image
        </button>
        <button
          onClick={loadImages}
          style={{
            padding: '12px 20px',
            backgroundColor: '#2196F3',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          🔄 Refresh
        </button>
      </div>

      {images.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#888' }}>
          <p>No images uploaded yet.</p>
          <p>Click "Upload Image" to add your first family photo!</p>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: '15px',
          maxHeight: '400px',
          overflowY: 'auto'
        }}>
          {images.map((image) => (
            <div
              key={image.id}
              style={{
                border: '1px solid #ddd',
                borderRadius: '8px',
                overflow: 'hidden',
                cursor: 'pointer',
                backgroundColor: '#fff',
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
                <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '5px' }}>
                  {image.originalFilename}
                </div>
                {image.description && (
                  <div style={{ fontSize: '11px', color: '#666', marginBottom: '5px' }}>
                    {image.description.length > 50 
                      ? image.description.substring(0, 50) + '...'
                      : image.description
                    }
                  </div>
                )}
                <div style={{ fontSize: '10px', color: '#999' }}>
                  {image.people.length} person{image.people.length !== 1 ? 's' : ''} tagged
                </div>
                <div style={{ fontSize: '10px', color: '#999' }}>
                  {new Date(image.uploadDate).toLocaleDateString()}
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
    <div>
      <div style={{ marginBottom: '20px' }}>
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
          ← Back to Gallery
        </button>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', marginBottom: '10px', fontWeight: 'bold' }}>
          Description (optional):
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Enter a description for this image..."
          style={{
            width: '100%',
            height: '80px',
            padding: '10px',
            border: '1px solid #ddd',
            borderRadius: '5px',
            fontSize: '14px',
            resize: 'vertical'
          }}
        />
      </div>

      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', marginBottom: '10px', fontWeight: 'bold' }}>
          Select Image:
        </label>
        <input
          type="file"
          accept="image/*"
          onChange={handleImageUpload}
          disabled={uploadingImage}
          style={{
            width: '100%',
            padding: '10px',
            border: '1px solid #ddd',
            borderRadius: '5px',
            fontSize: '14px'
          }}
        />
      </div>

      {uploadingImage && (
        <div style={{ textAlign: 'center', padding: '20px' }}>
          <div>Uploading image...</div>
          <div style={{ margin: '10px 0' }}>⏳</div>
        </div>
      )}

      <div style={{ fontSize: '12px', color: '#666', marginTop: '10px' }}>
        <p><strong>Supported formats:</strong> JPEG, PNG, GIF, WebP</p>
        <p><strong>Maximum file size:</strong> 10MB</p>
      </div>
    </div>
  );

  // Render image view
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
          ← Back to Gallery
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
          {taggingMode ? '✖ Cancel Tagging' : '🏷 Tag People'}
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
          🗑 Delete Image
        </button>
      </div>

      {taggingMode && (
        <div style={{
          padding: '15px',
          backgroundColor: '#f0f8ff',
          borderRadius: '5px',
          marginBottom: '20px',
          border: '1px solid #b0d4ff'
        }}>
          <h4 style={{ margin: '0 0 10px 0', color: '#1976d2' }}>Tag People in Image</h4>
          <p style={{ margin: '0 0 15px 0', fontSize: '14px' }}>
            Select a person from the family tree to tag them in this image.
          </p>
          
          {selectedNode ? (
            <div style={{ marginBottom: '15px' }}>
              <div style={{ fontSize: '14px', marginBottom: '10px' }}>
                <strong>Selected Person:</strong> {selectedNode.data.name} {selectedNode.data.surname}
              </div>
              <button
                onClick={() => handlePersonTag(selectedNode.id)}
                style={{
                  padding: '8px 15px',
                  backgroundColor: '#4CAF50',
                  color: 'white',
                  border: 'none',
                  borderRadius: '5px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                Tag This Person
              </button>
            </div>
          ) : (
            <div style={{ fontSize: '14px', color: '#666', marginBottom: '15px' }}>
              Please select a person from the family tree first.
            </div>
          )}

          <button
            onClick={() => setShowTaggingInstructions(!showTaggingInstructions)}
            style={{
              padding: '5px 10px',
              backgroundColor: 'transparent',
              color: '#1976d2',
              border: '1px solid #1976d2',
              borderRadius: '3px',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            {showTaggingInstructions ? 'Hide' : 'Show'} Instructions
          </button>

          {showTaggingInstructions && (
            <div style={{ marginTop: '10px', fontSize: '12px', color: '#666' }}>
              <p><strong>How to tag people:</strong></p>
              <ol style={{ paddingLeft: '20px' }}>
                <li>Click on a person in the family tree to select them</li>
                <li>Click "Tag This Person" button above</li>
                <li>The person will be associated with this image</li>
                <li>You can remove tags using the "Remove" button next to each tagged person</li>
              </ol>
            </div>
          )}
        </div>
      )}

      <div style={{ marginBottom: '20px' }}>
        <img
          src={selectedImage.s3Url}
          alt={selectedImage.description || selectedImage.originalFilename}
          style={{
            width: '100%',
            maxHeight: '400px',
            objectFit: 'contain',
            border: '1px solid #ddd',
            borderRadius: '5px'
          }}
        />
      </div>

      <div style={{ marginBottom: '20px' }}>
        <h4 style={{ margin: '0 0 10px 0' }}>Image Details</h4>
        <div style={{ fontSize: '14px', lineHeight: '1.5' }}>
          <div><strong>Filename:</strong> {selectedImage.originalFilename}</div>
          <div><strong>Upload Date:</strong> {new Date(selectedImage.uploadDate).toLocaleString()}</div>
          <div><strong>File Size:</strong> {(selectedImage.fileSize / 1024 / 1024).toFixed(2)} MB</div>
          {selectedImage.description && (
            <div><strong>Description:</strong> {selectedImage.description}</div>
          )}
        </div>
      </div>

      {selectedImage.people && selectedImage.people.length > 0 && (
        <div>
          <h4 style={{ margin: '0 0 10px 0' }}>Tagged People ({selectedImage.people.length})</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {selectedImage.people.map((person) => (
              <div
                key={person.personId}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px',
                  backgroundColor: '#f5f5f5',
                  borderRadius: '5px',
                  border: '1px solid #ddd'
                }}
              >
                <div
                  style={{ cursor: 'pointer', flex: 1 }}
                  onClick={() => onPersonSelect && onPersonSelect(person.personId)}
                >
                  <strong>{person.personName} {person.personSurname}</strong>
                </div>
                <button
                  onClick={() => handleRemovePersonTag(person.personId)}
                  style={{
                    padding: '5px 10px',
                    backgroundColor: '#f44336',
                    color: 'white',
                    border: 'none',
                    borderRadius: '3px',
                    cursor: 'pointer',
                    fontSize: '12px'
                  }}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {(!selectedImage.people || selectedImage.people.length === 0) && (
        <div style={{ textAlign: 'center', padding: '20px', color: '#666' }}>
          <p>No people tagged in this image yet.</p>
          <p>Click "Tag People" to start tagging family members!</p>
        </div>
      )}
    </div>
  );

  return (
    <div style={{
      padding: '20px',
      backgroundColor: 'white',
      borderRadius: '8px',
      maxHeight: '600px',
      overflowY: 'auto'
    }}>
      <h3 style={{ margin: '0 0 20px 0', color: '#333' }}>
        📸 Family Photos
      </h3>

      {viewMode === 'gallery' && renderGallery()}
      {viewMode === 'upload' && renderUpload()}
      {viewMode === 'view' && selectedImage && renderImageView()}
    </div>
  );
};

export default ImageGallery;
