import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { appConfig } from './config';
import { api } from './api';
import ChatComponent from './ChatComponent';

// Optimized PersonTag component to prevent re-renders
const PersonTag = React.memo(({ person, index }) => {
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseEnter = useCallback(() => setIsHovered(true), []);
  const handleMouseLeave = useCallback(() => setIsHovered(false), []);

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
    transition: 'background-color 0.2s ease'
  }), [isHovered]);

  return (
    <div
      key={person.personId || `person-${index}`}
      style={tagStyle}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <strong>{person.personName} {person.personSurname}</strong>
    </div>
  );
});

PersonTag.displayName = 'PersonTag';

const PersonPictureSlideshow = ({ personId, personName, preferredImageId, onPreferredImageChange, onClose }) => {
  const [images, setImages] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingDescription, setEditingDescription] = useState(false);
  const [descriptionValue, setDescriptionValue] = useState('');
  const [settingPreferred, setSettingPreferred] = useState(false);

  useEffect(() => {
    const loadPersonImages = async () => {
      try {
        setLoading(true);
        const imageData = await api.loadPersonImages(personId);
        setImages(imageData);
        setError(null);
      } catch (err) {
        console.error('Error loading person images:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (personId) {
      loadPersonImages();
    }
  }, [personId]);

  // Navigate to preferred image when images are loaded
  useEffect(() => {
    if (images.length > 0 && preferredImageId) {
      const preferredIndex = images.findIndex(img => img.id === preferredImageId);
      if (preferredIndex !== -1) {
        setCurrentIndex(preferredIndex);
      }
    }
  }, [images, preferredImageId]);

  const nextImage = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % images.length);
  }, [images.length]);

  const prevImage = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
  }, [images.length]);

  const goToImage = useCallback((index) => {
    setCurrentIndex(index);
  }, []);

  const startEditingDescription = useCallback(() => {
    setDescriptionValue(images[currentIndex].description || '');
    setEditingDescription(true);
  }, [images, currentIndex]);

  const cancelEditingDescription = useCallback(() => {
    setEditingDescription(false);
    setDescriptionValue('');
  }, []);

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

  const setAsPreferredImage = useCallback(async () => {
    if (!currentImage) return;
    
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
  }, [currentImage, personId, personName, onPreferredImageChange]);

  const removeAsPreferredImage = useCallback(async () => {
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
  }, [personId, personName, onPreferredImageChange]);

  // Memoize styles to prevent object recreation
  const navButtonLeftStyle = useMemo(() => ({
    ...navButtonStyle,
    left: '10px'
  }), []);

  const navButtonRightStyle = useMemo(() => ({
    ...navButtonStyle,
    right: '10px'
  }), []);

  const imageInfoStyle = {
    backgroundColor: '#222',
    padding: '15px',
    borderRadius: '8px',
    marginBottom: '20px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
  };

  if (loading) {
    return (
      <div style={overlayStyle}>
        <div style={modalStyle}>
          <div style={headerStyle}>
            <h3 style={{ margin: 0, color: '#ffffff' }}>{appConfig.ui.slideshow.loadingMessage}</h3>
            <button onClick={onClose} style={closeButtonStyle}>✖</button>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
            <div style={{ color: '#cccccc' }}>{appConfig.ui.slideshow.loadingMessage}</div>
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
            <h3 style={{ margin: 0, color: '#ffffff' }}>{appConfig.ui.slideshow.errorTitle}</h3>
            <button onClick={onClose} style={closeButtonStyle}>✖</button>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
            <div style={{ color: '#ff6b6b' }}>{appConfig.ui.slideshow.errorMessage}{error}</div>
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
            <h3 style={{ margin: 0, color: '#ffffff' }}>{appConfig.ui.slideshow.picturesTitle}{personName}</h3>
            <button onClick={onClose} style={closeButtonStyle}>✖</button>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
            <div style={{ color: '#cccccc', textAlign: 'center' }}>
              <div style={{ fontSize: '48px', marginBottom: '20px' }}>{appConfig.ui.slideshow.noPicturesIcon}</div>
              <div>{appConfig.ui.slideshow.noPicturesMessage}{personName}</div>
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
            {appConfig.ui.slideshow.picturesTitle}{personName} ({currentIndex + 1}/{images.length})
          </h3>
          <button onClick={onClose} style={closeButtonStyle}>✖</button>
        </div>

        <div style={contentStyle}>
          {/* Main Image Display */}
          <div style={imageContainerStyle}>
            {images.length > 1 && (
              <button 
                onClick={prevImage} 
                style={navButtonLeftStyle}
                disabled={images.length <= 1}
              >
                ◀
              </button>
            )}
            
            <img
              src={currentImage.s3Url}
              alt={currentImage.description || currentImage.originalFilename}
              style={mainImageStyle}
            />
            
            {images.length > 1 && (
              <button 
                onClick={nextImage} 
                style={navButtonRightStyle}
                disabled={images.length <= 1}
              >
                ▶
              </button>
            )}
          </div>

          {/* Image Info */}
          <div style={imageInfoStyle}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              marginBottom: '10px' 
            }}>
              <div style={{ fontWeight: 'bold', color: '#ffffff' }}>
                {appConfig.ui.slideshow.descriptionTitle}
              </div>
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
                  {appConfig.ui.slideshow.editButton}
                </button>
              )}
            </div>
            
            {editingDescription ? (
              <div style={{ marginBottom: '10px' }}>
                <textarea
                  value={descriptionValue}
                  onChange={handleDescriptionChange}
                  placeholder={appConfig.ui.slideshow.descriptionPlaceholder}
                  style={textareaStyle}
                />
                <div style={buttonContainerStyle}>
                  <button
                    onClick={saveDescription}
                    style={saveButtonStyle}
                  >
                    {appConfig.ui.slideshow.saveButton}
                  </button>
                  <button
                    onClick={cancelEditingDescription}
                    style={cancelButtonStyle}
                  >
                    {appConfig.ui.slideshow.cancelButton}
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ fontSize: '14px', color: '#cccccc', lineHeight: '1.5' }}>
                {currentImage.description || (
                  <em style={{ color: '#888' }}>Keine Beschreibung vorhanden</em>
                )}
              </div>
            )}
            
            {/* Preferred Image Controls */}
            <div style={{ 
              marginTop: '15px', 
              paddingTop: '15px', 
              borderTop: '1px solid #444',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div>
                {currentImage.id === preferredImageId ? (
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
                {currentImage.id === preferredImageId ? (
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

          {/* Tagged People Info */}
          {currentImage.people && currentImage.people.length > 0 && (
            <div style={imageInfoStyle}>
              <div style={{ fontWeight: 'bold', marginBottom: '10px', color: '#ffffff' }}>
                {appConfig.ui.slideshow.taggedPeopleTitle} ({currentImage.people.length})
              </div>
              <div style={peopleGridStyle}>
                {currentImage.people.map((person, index) => (
                  <PersonTag key={person.personId || `person-${index}`} person={person} index={index} />
                ))}
              </div>
            </div>
          )}

          {/* Thumbnail Navigation */}
          {images.length > 1 && (
            <div style={thumbnailContainerStyle}>
              {images.map((image, index) => (
                <img
                  key={image.id}
                  src={image.s3Url}
                  alt={image.originalFilename}
                  style={{
                    ...thumbnailStyle,
                    border: index === currentIndex ? '3px solid #4CAF50' : '2px solid #444',
                    opacity: index === currentIndex ? 1 : 0.7
                  }}
                  onClick={() => goToImage(index)}
                />
              ))}
            </div>
          )}

          {/* Chat Section */}
          <div style={imageInfoStyle}>
            <ChatComponent 
              imageId={currentImage?.id} 
              onError={(error) => console.error('Chat error:', error)}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

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
  zIndex: 1000
};

const modalStyle = {
  backgroundColor: '#1a1a1a',
  borderRadius: '10px',
  width: '80vw',
  height:'80vh',
  maxWidth: '3000px',
  maxHeight: '3000px',
  display: 'flex',
  flexDirection: 'column',
  border: '1px solid #444'
};

const headerStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '20px',
  borderBottom: '1px solid #444'
};

const closeButtonStyle = {
  background: '#ff6b6b',
  border: 'none',
  color: 'white',
  width: '30px',
  height: '30px',
  borderRadius: '50%',
  cursor: 'pointer',
  fontSize: '16px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center'
};

const contentStyle = {
  padding: '20px',
  flex: 1,
  overflow: 'auto'
};

const imageContainerStyle = {
  position: 'relative',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  marginBottom: '20px',
  flex: '1 1 0',
  minHeight: 0,
};

const mainImageStyle = {
  width: '100%',
  maxHeight: 'calc(46vh)', // leave space for info and tagged people
  objectFit: 'contain',
  borderRadius: '5px',
};

const navButtonStyle = {
  position: 'absolute',
  top: '50%',
  transform: 'translateY(-50%)',
  background: 'rgba(255, 255, 255, 0.8)',
  border: 'none',
  borderRadius: '50%',
  width: '40px',
  height: '40px',
  cursor: 'pointer',
  fontSize: '18px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 10,
};

const textareaStyle = {
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
};

const buttonContainerStyle = {
  display: 'flex',
  gap: '8px',
  marginTop: '8px'
};

const saveButtonStyle = {
  padding: '6px 12px',
  backgroundColor: '#4CAF50',
  color: 'white',
  border: 'none',
  borderRadius: '4px',
  cursor: 'pointer',
  fontSize: '12px'
};

const cancelButtonStyle = {
  padding: '6px 12px',
  backgroundColor: '#666',
  color: 'white',
  border: 'none',
  borderRadius: '4px',
  cursor: 'pointer',
  fontSize: '12px'
};

const peopleGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
  gap: '10px',
  marginTop: '10px',
  maxHeight: '120px', // only scroll if more than one row
  overflowY: 'auto',
};

const thumbnailContainerStyle = {
  display: 'flex',
  gap: '8px',
  overflowX: 'auto',
  padding: '10px 0',
  marginTop: '20px'
};

const thumbnailStyle = {
  width: '60px',
  height: '60px',
  objectFit: 'cover',
  borderRadius: '4px',
  cursor: 'pointer',
  transition: 'opacity 0.2s ease'
};

export default PersonPictureSlideshow;
