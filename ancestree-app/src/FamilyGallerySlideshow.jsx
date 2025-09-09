import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { appConfig } from './config';
import { api } from './api';

// Optimized PersonTag component to prevent re-renders
const PersonTag = React.memo(({ person, index, onPersonSelect }) => {
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseEnter = useCallback(() => setIsHovered(true), []);
  const handleMouseLeave = useCallback(() => setIsHovered(false), []);
  const handleClick = useCallback(() => {
    if (onPersonSelect && person.personId) {
      onPersonSelect(person.personId);
    }
  }, [onPersonSelect, person.personId]);

  const tagStyle = useMemo(() => ({
    fontSize: '14px',
    color: '#cccccc',
    padding: '10px',
    backgroundColor: isHovered ? '#444444' : '#333333',
    borderRadius: '6px',
    border: '1px solid #555',
    textAlign: 'center',
    minHeight: '40px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background-color 0.2s ease',
    cursor: onPersonSelect ? 'pointer' : 'default'
  }), [isHovered, onPersonSelect]);

  return (
    <div
      key={person.personId || `person-${index}`}
      style={tagStyle}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
    >
      <strong>{person.personName} {person.personSurname}</strong>
    </div>
  );
});

PersonTag.displayName = 'PersonTag';

const FamilyGallerySlideshow = ({ onClose, onPersonSelect }) => {
  console.log('FamilyGallerySlideshow: Component called with onClose:', typeof onClose, 'onPersonSelect:', typeof onPersonSelect);
  const [images, setImages] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [descriptionValue, setDescriptionValue] = useState('');
  const [editingDescription, setEditingDescription] = useState(false);

  const loadImages = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Load all family images
      console.log('Family Gallery: Starting to load images...');
      const imagesData = await api.loadImages();
      console.log('Family Gallery: Loaded images data:', imagesData);
      
      if (!Array.isArray(imagesData)) {
        throw new Error('Invalid response: expected array of images');
      }
      
      setImages(imagesData);
      
      // If we have images, load details for the first one
      if (imagesData.length > 0) {
        setCurrentIndex(0);
        setDescriptionValue(imagesData[0].description || '');
        console.log('Family Gallery: First image:', imagesData[0]);
      } else {
        console.log('Family Gallery: No images found');
      }
    } catch (err) {
      console.error('Error loading family images:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    console.log('FamilyGallerySlideshow: Component mounted, starting to load images...');
    loadImages();
  }, [loadImages]);

  // Update description value when current image changes
  useEffect(() => {
    if (images[currentIndex]) {
      setDescriptionValue(images[currentIndex].description || '');
      setEditingDescription(false);
    }
  }, [currentIndex, images]);

  const saveDescription = useCallback(async () => {
    try {
      await api.updateImageDescription(images[currentIndex].id, descriptionValue);

      // Update the current image and images array
      const updatedImages = [...images];
      updatedImages[currentIndex] = { ...images[currentIndex], description: descriptionValue };
      setImages(updatedImages);
      setEditingDescription(false);
    } catch (err) {
      console.error('Error updating description:', err);
      alert('Failed to update description: ' + err.message);
    }
  }, [images, currentIndex, descriptionValue]);

  const handleDescriptionChange = useCallback((e) => {
    setDescriptionValue(e.target.value);
  }, []);

  // Memoize current image to prevent unnecessary recalculations
  const currentImage = useMemo(() => {
    return images[currentIndex];
  }, [images, currentIndex]);

  // Navigation functions
  const nextImage = useCallback(() => {
    setCurrentIndex((prevIndex) => (prevIndex + 1) % images.length);
  }, [images.length]);

  const prevImage = useCallback(() => {
    setCurrentIndex((prevIndex) => (prevIndex - 1 + images.length) % images.length);
  }, [images.length]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyPress = (event) => {
      if (event.key === 'ArrowRight') {
        nextImage();
      } else if (event.key === 'ArrowLeft') {
        prevImage();
      } else if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [nextImage, prevImage, onClose]);

  // Styles (reused from PersonPictureSlideshow)
  const overlayStyle = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2000
  };

  const modalStyle = {
    backgroundColor: '#1a1a1a',
    borderRadius: '12px',
    width: '90vw',
    maxWidth: '1200px',
    height: '90vh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.8)'
  };

  const headerStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px',
    borderBottom: '1px solid #333',
    backgroundColor: '#262626'
  };

  const closeButtonStyle = {
    background: 'none',
    border: 'none',
    color: '#ffffff',
    fontSize: '24px',
    cursor: 'pointer',
    padding: '8px',
    borderRadius: '4px',
    transition: 'background-color 0.2s ease'
  };

  const contentStyle = {
    display: 'flex',
    flex: 1,
    overflow: 'hidden'
  };

  const imageContainerStyle = {
    flex: 1,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    backgroundColor: '#000000'
  };

  const imageStyle = {
    maxWidth: '100%',
    maxHeight: '100%',
    objectFit: 'contain'
  };

  const sidebarStyle = {
    width: '400px',
    padding: '20px',
    backgroundColor: '#262626',
    color: '#ffffff',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
    overflowY: 'auto'
  };

  const navButtonStyle = (position) => ({
    position: 'absolute',
    top: '50%',
    [position]: '20px',
    transform: 'translateY(-50%)',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    color: 'white',
    border: 'none',
    borderRadius: '50%',
    width: '50px',
    height: '50px',
    fontSize: '24px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background-color 0.2s ease'
  });

  if (loading) {
    console.log('FamilyGallerySlideshow: Rendering loading state');
    return (
      <div style={overlayStyle}>
        <div style={modalStyle}>
          <div style={headerStyle}>
            <h3 style={{ margin: 0, color: '#ffffff' }}>{appConfig.ui.familyGallery.loadingTitle}</h3>
            <button onClick={onClose} style={closeButtonStyle}>✖</button>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
            <div style={{ color: '#cccccc' }}>{appConfig.ui.familyGallery.loadingMessage}</div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={overlayStyle}>
        <div style={modalStyle}>
          <div style={headerStyle}>
            <h3 style={{ margin: 0, color: '#ffffff' }}>{appConfig.ui.familyGallery.errorTitle}</h3>
            <button onClick={onClose} style={closeButtonStyle}>✖</button>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
            <div style={{ color: '#ff6b6b' }}>{appConfig.ui.familyGallery.errorMessage}{error}</div>
          </div>
        </div>
      </div>
    );
  }

  if (images.length === 0) {
    return (
      <div style={overlayStyle}>
        <div style={modalStyle}>
          <div style={headerStyle}>
            <h3 style={{ margin: 0, color: '#ffffff' }}>{appConfig.ui.familyGallery.title}</h3>
            <button onClick={onClose} style={closeButtonStyle}>✖</button>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
            <div style={{ color: '#cccccc', textAlign: 'center' }}>
              <div style={{ fontSize: '48px', marginBottom: '20px' }}>{appConfig.ui.familyGallery.noPicturesIcon}</div>
              <h3>{appConfig.ui.familyGallery.noPicturesTitle}</h3>
              <div>{appConfig.ui.familyGallery.noPicturesMessage}</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        <div style={headerStyle}>
          <h3 style={{ margin: 0, color: '#ffffff' }}>
            {appConfig.ui.familyGallery.title} ({currentIndex + 1}/{images.length})
          </h3>
          <button onClick={onClose} style={closeButtonStyle}>✖</button>
        </div>

        <div style={contentStyle}>
          {/* Main Image Display */}
          <div style={imageContainerStyle}>
            {images.length > 1 && (
              <button 
                onClick={prevImage} 
                style={navButtonStyle('left')}
                onMouseOver={(e) => e.target.style.backgroundColor = 'rgba(0, 0, 0, 0.9)'}
                onMouseOut={(e) => e.target.style.backgroundColor = 'rgba(0, 0, 0, 0.7)'}
              >
                ◀
              </button>
            )}
            
            {currentImage && (
              <img
                src={currentImage.s3Url || currentImage.url}
                alt={currentImage.description || `Familie Bild ${currentIndex + 1}`}
                style={imageStyle}
                onError={(e) => {
                  console.error('Error loading image:', currentImage);
                  e.target.style.display = 'none';
                }}
              />
            )}
            
            {images.length > 1 && (
              <button 
                onClick={nextImage} 
                style={navButtonStyle('right')}
                onMouseOver={(e) => e.target.style.backgroundColor = 'rgba(0, 0, 0, 0.9)'}
                onMouseOut={(e) => e.target.style.backgroundColor = 'rgba(0, 0, 0, 0.7)'}
              >
                ▶
              </button>
            )}
          </div>

          {/* Sidebar with Image Info */}
          <div style={sidebarStyle}>
            {/* Description Section */}
            <div>
              <h4 style={{ margin: '0 0 10px 0', color: '#ffffff' }}>
                {appConfig.ui.familyGallery.descriptionTitle}
              </h4>
              {editingDescription ? (
                <div>
                  <textarea
                    value={descriptionValue}
                    onChange={handleDescriptionChange}
                    placeholder={appConfig.ui.familyGallery.descriptionPlaceholder}
                    style={{
                      width: '100%',
                      minHeight: '100px',
                      padding: '10px',
                      backgroundColor: '#333333',
                      color: '#ffffff',
                      border: '1px solid #555555',
                      borderRadius: '6px',
                      resize: 'vertical',
                      fontSize: '14px',
                      fontFamily: 'inherit'
                    }}
                  />
                  <div style={{ marginTop: '10px', display: 'flex', gap: '10px' }}>
                    <button
                      onClick={saveDescription}
                      style={{
                        padding: '8px 16px',
                        backgroundColor: '#4CAF50',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '14px'
                      }}
                    >
                      {appConfig.ui.familyGallery.saveButton}
                    </button>
                    <button
                      onClick={() => {
                        setEditingDescription(false);
                        setDescriptionValue(currentImage?.description || '');
                      }}
                      style={{
                        padding: '8px 16px',
                        backgroundColor: '#666666',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '14px'
                      }}
                    >
                      {appConfig.ui.familyGallery.cancelButton}
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <p style={{ 
                    margin: '0 0 10px 0', 
                    color: '#cccccc',
                    fontStyle: currentImage?.description ? 'normal' : 'italic'
                  }}>
                    {currentImage?.description || appConfig.ui.familyGallery.noDescription}
                  </p>
                  <button
                    onClick={() => setEditingDescription(true)}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: '#2196F3',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '14px'
                    }}
                  >
                    {appConfig.ui.familyGallery.editButton}
                  </button>
                </div>
              )}
            </div>

            {/* Tagged People Section */}
            <div>
              <h4 style={{ margin: '0 0 10px 0', color: '#ffffff' }}>
                {appConfig.ui.familyGallery.taggedPeopleTitle}
              </h4>
              {currentImage?.people && currentImage.people.length > 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px' }}>
                  {currentImage.people.map((person, index) => (
                    <PersonTag
                      key={person.personId || `person-${index}`}
                      person={person}
                      index={index}
                      onPersonSelect={onPersonSelect}
                    />
                  ))}
                </div>
              ) : (
                <p style={{ margin: 0, color: '#999999', fontStyle: 'italic' }}>
                  {appConfig.ui.familyGallery.noTaggedPeople}
                </p>
              )}
            </div>

            {/* Navigation hints */}
            {images.length > 1 && (
              <div style={{ 
                marginTop: 'auto',
                padding: '10px',
                backgroundColor: '#333333',
                borderRadius: '6px',
                fontSize: '12px',
                color: '#999999'
              }}>
                <div>Tastatur-Navigation:</div>
                <div>← → Bilder wechseln</div>
                <div>Esc Schließen</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FamilyGallerySlideshow;
