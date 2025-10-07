import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { appConfig } from './config';
import { api } from './api';
import ChatComponent from './ChatComponent';

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

const PictureSlideshow = ({ 
  mode = 'family', // 'family' or 'person'
  personId, 
  personName, 
  preferredImageId, 
  onPreferredImageChange,
  onClose, 
  onPersonSelect 
}) => {
  console.log('PictureSlideshow: Component called with mode:', mode, 'personId:', personId);
  const [images, setImages] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [descriptionValue, setDescriptionValue] = useState('');
  const [editingDescription, setEditingDescription] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [settingPreferred, setSettingPreferred] = useState(false);

  const loadImages = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      let imagesData;
      if (mode === 'person') {
        // Load images for specific person
        console.log('PictureSlideshow: Loading images for person:', personId);
        imagesData = await api.loadPersonImages(personId);
      } else {
        // Load all family images
        console.log('PictureSlideshow: Loading all family images...');
        imagesData = await api.loadImages();
      }
      
      console.log('PictureSlideshow: Loaded images data:', imagesData);
      
      if (!Array.isArray(imagesData)) {
        throw new Error('Invalid response: expected array of images');
      }
      
      setImages(imagesData);
      
      // If we have images, load details for the first one
      if (imagesData.length > 0) {
        // For person mode, navigate to preferred image if available
        if (mode === 'person' && preferredImageId) {
          const preferredIndex = imagesData.findIndex(img => img.id === preferredImageId);
          if (preferredIndex !== -1) {
            setCurrentIndex(preferredIndex);
            setDescriptionValue(imagesData[preferredIndex].description || '');
            console.log('PictureSlideshow: Navigated to preferred image at index:', preferredIndex);
          } else {
            setCurrentIndex(0);
            setDescriptionValue(imagesData[0].description || '');
          }
        } else {
          setCurrentIndex(0);
          setDescriptionValue(imagesData[0].description || '');
        }
        console.log('PictureSlideshow: First image:', imagesData[0]);
      } else {
        console.log('PictureSlideshow: No images found');
      }
    } catch (err) {
      console.error('Error loading images:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [mode, personId, preferredImageId]);

  useEffect(() => {
    console.log('PictureSlideshow: Component mounted, starting to load images...');
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

  const setAsPreferredImage = useCallback(async () => {
    if (!currentImage || mode !== 'person') return;
    
    try {
      setSettingPreferred(true);
      await api.setPreferredImage(personId, currentImage.id);
      
      // Call the callback to update the parent component
      if (onPreferredImageChange) {
        onPreferredImageChange(currentImage.id);
      }
      
      alert(`Bild wurde als Profilbild für ${personName} gesetzt.`);
    } catch (err) {
      console.error('Error setting preferred image:', err);
      alert('Fehler beim Setzen des Profilbildes: ' + err.message);
    } finally {
      setSettingPreferred(false);
    }
  }, [mode, personId, personName, onPreferredImageChange]);

  const removeAsPreferredImage = useCallback(async () => {
    if (mode !== 'person') return;
    
    try {
      setSettingPreferred(true);
      await api.setPreferredImage(personId, null);
      
      // Call the callback to update the parent component
      if (onPreferredImageChange) {
        onPreferredImageChange(null);
      }
      
      alert(`Profilbild für ${personName} wurde entfernt.`);
    } catch (err) {
      console.error('Error removing preferred image:', err);
      alert('Fehler beim Entfernen des Profilbildes: ' + err.message);
    } finally {
      setSettingPreferred(false);
    }
  }, [mode, personId, personName, onPreferredImageChange]);

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

  // Fullscreen functionality
  const toggleFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        // Enter fullscreen
        const element = document.documentElement;
        if (element.requestFullscreen) {
          await element.requestFullscreen();
        } else if (element.webkitRequestFullscreen) {
          await element.webkitRequestFullscreen();
        } else if (element.msRequestFullscreen) {
          await element.msRequestFullscreen();
        }
        setIsFullscreen(true);
      } else {
        // Exit fullscreen
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
          await document.webkitExitFullscreen();
        } else if (document.msExitFullscreen) {
          await document.msExitFullscreen();
        }
        setIsFullscreen(false);
      }
    } catch (err) {
      console.error('Error toggling fullscreen:', err);
    }
  }, []);

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('msfullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('msfullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Get appropriate config based on mode
  const config = mode === 'person' ? appConfig.ui.slideshow : appConfig.ui.familyGallery;

  // Styles
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

  const fullscreenButtonStyle = {
    padding: '6px 12px',
    backgroundColor: '#4CAF50',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
    display: 'flex',
    alignItems: 'center',
    gap: '5px'
  };

  const fullscreenOverlayStyle = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 1)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2000
  };

  const fullscreenModalStyle = {
    backgroundColor: '#1a1a1a',
    width: '100vw',
    height: '100vh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    boxShadow: 'none'
  };

  const fullscreenImageStyle = {
    maxWidth: '100%',
    maxHeight: 'calc(100vh - 80px)', // Full screen height minus header
    objectFit: 'contain'
  };

  if (loading) {
    console.log('PictureSlideshow: Rendering loading state');
    return (
      <div style={overlayStyle}>
        <div style={modalStyle}>
          <div style={headerStyle}>
            <h3 style={{ margin: 0, color: '#ffffff' }}>{config.loadingTitle}</h3>
            <button onClick={onClose} style={closeButtonStyle}>✖</button>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
            <div style={{ color: '#cccccc' }}>{config.loadingMessage}</div>
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
            <h3 style={{ margin: 0, color: '#ffffff' }}>{config.errorTitle}</h3>
            <button onClick={onClose} style={closeButtonStyle}>✖</button>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
            <div style={{ color: '#ff6b6b' }}>{config.errorMessage}{error}</div>
          </div>
        </div>
      </div>
    );
  }

  if (images.length === 0) {
    const emptyMessage = mode === 'person' 
      ? `${config.noPicturesMessage}${personName}`
      : config.noPicturesMessage;
    const emptyTitle = mode === 'person'
      ? `${config.picturesTitle}${personName}`
      : config.title;

    return (
      <div style={overlayStyle}>
        <div style={modalStyle}>
          <div style={headerStyle}>
            <h3 style={{ margin: 0, color: '#ffffff' }}>{emptyTitle}</h3>
            <button onClick={onClose} style={closeButtonStyle}>✖</button>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
            <div style={{ color: '#cccccc', textAlign: 'center' }}>
              <div style={{ fontSize: '48px', marginBottom: '20px' }}>{config.noPicturesIcon}</div>
              <h3>{config.noPicturesTitle || ''}</h3>
              <div>{emptyMessage}</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const title = mode === 'person'
    ? `${config.picturesTitle}${personName} (${currentIndex + 1}/${images.length})`
    : `${config.title} (${currentIndex + 1}/${images.length})`;

  return (
    <div style={isFullscreen ? fullscreenOverlayStyle : overlayStyle}>
      <div style={isFullscreen ? fullscreenModalStyle : modalStyle}>
        <div style={headerStyle}>
          <h3 style={{ margin: 0, color: '#ffffff' }}>
            {title}
          </h3>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            {isFullscreen ? (
              <button onClick={toggleFullscreen} style={fullscreenButtonStyle}>
                {config.exitFullscreenButton}
              </button>
            ) : (
              <>
                <button onClick={toggleFullscreen} style={fullscreenButtonStyle}>
                  {config.fullscreenButton}
                </button>
                <button onClick={onClose} style={closeButtonStyle}>✖</button>
              </>
            )}
          </div>
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
                alt={currentImage.description || `Bild ${currentIndex + 1}`}
                style={isFullscreen ? fullscreenImageStyle : imageStyle}
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
          {!isFullscreen && (
          <div style={sidebarStyle}>
            {/* Description Section */}
            <div>
              <h4 style={{ margin: '0 0 10px 0', color: '#ffffff' }}>
                {config.descriptionTitle}
              </h4>
              {editingDescription ? (
                <div>
                  <textarea
                    value={descriptionValue}
                    onChange={handleDescriptionChange}
                    placeholder={config.descriptionPlaceholder}
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
                      {config.saveButton}
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
                      {config.cancelButton}
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
                    {currentImage?.description || config.noDescription}
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
                    {config.editButton}
                  </button>
                </div>
              )}
            </div>

            {/* Preferred Image Controls - Only in person mode */}
            {mode === 'person' && (
              <div style={{ 
                padding: '15px',
                backgroundColor: '#333333',
                borderRadius: '6px',
                border: '1px solid #444'
              }}>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <div>
                    {currentImage?.id === preferredImageId ? (
                      <div style={{ 
                        display: 'flex', 
                        alignItems: 'center',
                        color: '#4CAF50',
                        fontSize: '14px'
                      }}>
                        <span style={{ marginRight: '8px' }}>⭐</span>
                        <strong>Aktuelles Profilbild</strong>
                      </div>
                    ) : (
                      <div style={{ 
                        color: '#cccccc',
                        fontSize: '14px'
                      }}>
                        Als Profilbild verwenden
                      </div>
                    )}
                  </div>
                  
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {currentImage?.id === preferredImageId ? (
                      <button
                        onClick={removeAsPreferredImage}
                        disabled={settingPreferred}
                        style={{
                          padding: '6px 12px',
                          backgroundColor: settingPreferred ? '#666' : '#ff6b6b',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: settingPreferred ? 'not-allowed' : 'pointer',
                          fontSize: '12px'
                        }}
                      >
                        {settingPreferred ? 'Wird entfernt...' : 'Entfernen'}
                      </button>
                    ) : (
                      <button
                        onClick={setAsPreferredImage}
                        disabled={settingPreferred}
                        style={{
                          padding: '6px 12px',
                          backgroundColor: settingPreferred ? '#666' : '#4CAF50',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: settingPreferred ? 'not-allowed' : 'pointer',
                          fontSize: '12px'
                        }}
                      >
                        {settingPreferred ? 'Wird gesetzt...' : 'Als Profilbild setzen'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Tagged People Section */}
            <div>
              <h4 style={{ margin: '0 0 10px 0', color: '#ffffff' }}>
                {config.taggedPeopleTitle}
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
                  {config.noTaggedPeople}
                </p>
              )}
            </div>

            {/* Chat Section */}
            <div>
              <ChatComponent 
                imageId={currentImage?.id} 
                onError={(error) => console.error('Chat error:', error)}
              />
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
          )}
        </div>
      </div>
    </div>
  );
};

export default PictureSlideshow;
