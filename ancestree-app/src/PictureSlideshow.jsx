import { encryptedApi } from './encryptedApi';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { appConfig } from './config';
import { api } from './api';
import ChatComponent from './ChatComponent';
import DescriptionTextarea from './components/DescriptionTextarea';
import Button from './components/Button';

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

// Optimized SlideshowImage component - only re-renders when image or question status changes
const SlideshowImage = React.memo(({ currentImage, isFullscreen, imageStyle, fullscreenImageStyle }) => {
  if (!currentImage) return null;

  return (
    <div style={{
      position: 'relative',
      maxWidth: '100%',
      maxHeight: '100%',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center'
    }}>
      <img
        src={currentImage.s3Url || currentImage.url}
        alt={currentImage.description || 'Bild'}
        style={isFullscreen ? fullscreenImageStyle : imageStyle}
        onError={(e) => {
          console.error('Error loading image:', currentImage);
          e.target.style.display = 'none';
        }}
      />
      {currentImage.has_open_questions && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          border: '4px solid #dc3545',
          pointerEvents: 'none',
          transition: 'opacity 0.2s',
          boxSizing: 'border-box'
        }} />
      )}
    </div>
  );
}, (prevProps, nextProps) => {
  // Only re-render if the image ID or question status changes
  return prevProps.currentImage?.id === nextProps.currentImage?.id &&
         prevProps.currentImage?.has_open_questions === nextProps.currentImage?.has_open_questions &&
         prevProps.isFullscreen === nextProps.isFullscreen;
});

SlideshowImage.displayName = 'SlideshowImage';

const PictureSlideshow = ({ 
  mode = 'family', // 'family' or 'person'
  personId, 
  personName, 
  preferredImageId, 
  onPreferredImageChange,
  onClose, 
  onPersonSelect,
  socket
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

  // Handle question toggle
  const toggleImageQuestion = useCallback(async () => {
    const image = images[currentIndex];
    if (!image) return;
    
    const newValue = !image.has_open_questions;
    
    try {
      await api.toggleImageQuestion(image.id, newValue);
      
      // Update local state
      const updatedImages = [...images];
      updatedImages[currentIndex] = { ...image, has_open_questions: newValue };
      setImages(updatedImages);
    } catch (err) {
      console.error('Error toggling image question:', err);
      alert('Fehler beim Markieren des Bildes: ' + err.message);
    }
  }, [images, currentIndex]);

  // Listen for Socket.IO question toggle events
  useEffect(() => {
    if (!socket) return;

    const handleQuestionToggled = (data) => {
      console.log('[PictureSlideshow] Received imageQuestionToggled event:', data);
      const { imageId, hasOpenQuestions } = data;
      
      // Update images if this image is in the current set
      setImages(prevImages => {
        const index = prevImages.findIndex(img => img.id === imageId);
        if (index === -1) {
          console.log('[PictureSlideshow] Image not found in current images');
          return prevImages;
        }
        
        console.log(`[PictureSlideshow] Updating image at index ${index} with has_open_questions=${hasOpenQuestions}`);
        // Create a new array with the updated image
        const updatedImages = prevImages.map((img, idx) => 
          idx === index 
            ? { ...img, has_open_questions: hasOpenQuestions }
            : img
        );
        
        return updatedImages;
      });
    };

    console.log('[PictureSlideshow] Registering imageQuestionToggled listener');
    socket.on('imageQuestionToggled', handleQuestionToggled);

    return () => {
      console.log('[PictureSlideshow] Unregistering imageQuestionToggled listener');
      socket.off('imageQuestionToggled', handleQuestionToggled);
    };
  }, [socket]);

  const loadImages = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      let imagesData;
      if (mode === 'person') {
        // Load images for specific person
        console.log('PictureSlideshow: Loading images for person:', personId);
        imagesData = await encryptedApi.loadPersonImages(personId);
      } else {
        // Load all family images
        console.log('PictureSlideshow: Loading all family images...');
        imagesData = await encryptedApi.loadImages();
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
      await encryptedApi.updateImageDescription(images[currentIndex].id, descriptionValue);

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

  // Handle keyboard shortcuts in description textarea
  const handleDescriptionKeyDown = useCallback((e) => {
    // Ctrl+Enter to save
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      saveDescription();
    }
  }, [saveDescription]);

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
            <div style={{ width: '80px' }}>
              <Button onClick={onClose} variant="danger" size="medium" icon="✖">
                {/* Close button */}
              </Button>
            </div>
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
            <div style={{ width: '80px' }}>
              <Button onClick={onClose} variant="danger" size="medium" icon="✖">
                {/* Close button */}
              </Button>
            </div>
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
            <div style={{ width: '80px' }}>
              <Button onClick={onClose} variant="danger" size="medium" icon="✖">
                {/* Close button */}
              </Button>
            </div>
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
      <div className="slideshow-modal" style={isFullscreen ? fullscreenModalStyle : modalStyle}>
        <div className="slideshow-header" style={headerStyle}>
          <h3 style={{ margin: 0, color: '#ffffff' }}>
            {title}
          </h3>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Question Mark Button with Info Text */}
            <Button
              onClick={toggleImageQuestion}
              variant={currentImage?.has_open_questions ? 'danger' : 'secondary'}
              size="medium"
              style={{ 
                whiteSpace: 'normal',
                width: 'auto',
                maxWidth: 'none'
              }}
            >
              {config.questionButton}
            </Button>

            {isFullscreen ? (
              <Button onClick={toggleFullscreen} variant="success" size="medium">
                {config.exitFullscreenButton}
              </Button>
            ) : (
              <>
                <Button onClick={toggleFullscreen} variant="success" size="medium">
                  {config.fullscreenButton}
                </Button>
                <Button onClick={onClose} variant="danger" size="medium" icon="✖">
                  {/* Close button */}
                </Button>
              </>
            )}
          </div>
        </div>

        <div className="slideshow-content" style={contentStyle}>
          {/* Main Image Display */}
          <div className="slideshow-image-container" style={imageContainerStyle}>
            {images.length > 1 && (
              <button
                onClick={prevImage}
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: '20px',
                  transform: 'translateY(-50%)',
                  width: '50px',
                  height: '50px',
                  backgroundColor: 'rgba(0, 0, 0, 0.5)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '28px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'background-color 0.2s ease, transform 0.1s ease',
                  zIndex: 10,
                  fontWeight: 'bold'
                }}
                onMouseEnter={(e) => e.target.style.backgroundColor = 'rgba(0, 0, 0, 0.7)'}
                onMouseLeave={(e) => e.target.style.backgroundColor = 'rgba(0, 0, 0, 0.5)'}
                onMouseDown={(e) => e.target.style.transform = 'translateY(-50%) scale(0.95)'}
                onMouseUp={(e) => e.target.style.transform = 'translateY(-50%) scale(1)'}
              >
                {config.previousButton}
              </button>
            )}
            
            <SlideshowImage
              currentImage={currentImage}
              isFullscreen={isFullscreen}
              imageStyle={imageStyle}
              fullscreenImageStyle={fullscreenImageStyle}
            />
            
            {images.length > 1 && (
              <button
                onClick={nextImage}
                style={{
                  position: 'absolute',
                  top: '50%',
                  right: '20px',
                  transform: 'translateY(-50%)',
                  width: '50px',
                  height: '50px',
                  backgroundColor: 'rgba(0, 0, 0, 0.5)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '28px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'background-color 0.2s ease, transform 0.1s ease',
                  zIndex: 10,
                  fontWeight: 'bold'
                }}
                onMouseEnter={(e) => e.target.style.backgroundColor = 'rgba(0, 0, 0, 0.7)'}
                onMouseLeave={(e) => e.target.style.backgroundColor = 'rgba(0, 0, 0, 0.5)'}
                onMouseDown={(e) => e.target.style.transform = 'translateY(-50%) scale(0.95)'}
                onMouseUp={(e) => e.target.style.transform = 'translateY(-50%) scale(1)'}
              >
                {config.nextButton}
              </button>
            )}
          </div>

          {/* Sidebar with Image Info */}
          {!isFullscreen && (
          <div className="slideshow-sidebar" style={sidebarStyle}>
            {/* Description Section */}
            <div className="slideshow-description-section">
              <h4 style={{ margin: '0 0 10px 0', color: '#ffffff' }}>
                {config.descriptionTitle}
              </h4>
              {editingDescription ? (
                <DescriptionTextarea
                  value={descriptionValue}
                  onChange={handleDescriptionChange}
                  onSave={saveDescription}
                  onCancel={() => {
                    setEditingDescription(false);
                    setDescriptionValue(currentImage?.description || '');
                  }}
                  placeholder={config.descriptionPlaceholder}
                  maxLength={1000}
                  minHeight="120px"
                  saveButtonText={config.saveButton}
                  cancelButtonText={config.cancelButton}
                />
              ) : (
                <div>
                  <div 
                    className="slideshow-description-text"
                    style={{ 
                      margin: '0 0 10px 0', 
                      color: '#cccccc',
                      fontStyle: currentImage?.description ? 'normal' : 'italic'
                    }}
                  >
                    {currentImage?.description ? (
                      currentImage.description.split('\n\n').map((paragraph, idx) => (
                        <p key={idx} style={{ marginTop: idx === 0 ? 0 : '1em', marginBottom: 0 }}>
                          {paragraph.split('\n').map((line, lineIdx) => (
                            <React.Fragment key={lineIdx}>
                              {lineIdx > 0 && <br />}
                              {line}
                            </React.Fragment>
                          ))}
                        </p>
                      ))
                    ) : (
                      config.noDescription
                    )}
                  </div>
                  <Button
                    onClick={() => setEditingDescription(true)}
                    variant="primary"
                  size="medium"
                  >
                    {config.editButton}
                  </Button>
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
                      <div style={{ width: '140px' }}>
                        <Button
                          onClick={removeAsPreferredImage}
                          disabled={settingPreferred}
                          variant="danger"
                          size="medium"
                        >
                          {settingPreferred ? 'Wird entfernt...' : 'Entfernen'}
                        </Button>
                      </div>
                    ) : (
                      <div style={{ width: '180px' }}>
                        <Button
                          onClick={setAsPreferredImage}
                          disabled={settingPreferred}
                          variant="success"
                          size="medium"
                        >
                          {settingPreferred ? 'Wird gesetzt...' : 'Als Profilbild setzen'}
                        </Button>
                      </div>
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
                socket={socket}
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
