import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { appConfig } from './config';
import { api } from './api';

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

const FamilyPictureSlideshow = ({ onClose }) => {
  const [images, setImages] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingDescription, setEditingDescription] = useState(false);
  const [descriptionValue, setDescriptionValue] = useState('');

  // Load all family images
  useEffect(() => {
    const loadImages = async () => {
      try {
        setLoading(true);
        const imagesData = await api.loadImages();
        setImages(imagesData);
        setError(null);
      } catch (err) {
        console.error('Error loading images:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadImages();
  }, []);

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
    setDescriptionValue(images[currentIndex]?.description || '');
    setEditingDescription(true);
  }, [images, currentIndex]);

  const cancelEditingDescription = useCallback(() => {
    setEditingDescription(false);
    setDescriptionValue('');
  }, []);

  const saveDescription = useCallback(async () => {
    try {
      const currentImage = images[currentIndex];
      await api.updateImageDescription(currentImage.id, descriptionValue);

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

  if (loading) {
    return (
      <div style={overlayStyle}>
        <div style={modalStyle}>
          <div style={headerStyle}>
            <h3 style={{ margin: 0, color: '#ffffff' }}>{appConfig.ui.familySlideshow.loadingTitle}</h3>
            <button onClick={onClose} style={closeButtonStyle}>✖</button>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
            <div style={{ color: '#cccccc' }}>{appConfig.ui.familySlideshow.loadingMessage}</div>
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
            <h3 style={{ margin: 0, color: '#ffffff' }}>{appConfig.ui.familySlideshow.errorTitle}</h3>
            <button onClick={onClose} style={closeButtonStyle}>✖</button>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
            <div style={{ color: '#ff6b6b' }}>{appConfig.ui.familySlideshow.errorMessage}{error}</div>
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
            <h3 style={{ margin: 0, color: '#ffffff' }}>{appConfig.ui.familySlideshow.title}</h3>
            <button onClick={onClose} style={closeButtonStyle}>✖</button>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
            <div style={{ color: '#cccccc', textAlign: 'center' }}>
              <div style={{ fontSize: '48px', marginBottom: '20px' }}>📷</div>
              <div>{appConfig.ui.familySlideshow.noImagesMessage}</div>
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
            {appConfig.ui.familySlideshow.title} ({currentIndex + 1}/{images.length})
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
                {appConfig.ui.familySlideshow.descriptionTitle}
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
                  {appConfig.ui.familySlideshow.editButton}
                </button>
              )}
            </div>
            
            {editingDescription ? (
              <div style={{ marginBottom: '10px' }}>
                <textarea
                  value={descriptionValue}
                  onChange={handleDescriptionChange}
                  placeholder={appConfig.ui.familySlideshow.descriptionPlaceholder}
                  style={textareaStyle}
                />
                <div style={buttonContainerStyle}>
                  <button
                    onClick={saveDescription}
                    style={saveButtonStyle}
                  >
                    {appConfig.ui.familySlideshow.saveButton}
                  </button>
                  <button
                    onClick={cancelEditingDescription}
                    style={cancelButtonStyle}
                  >
                    {appConfig.ui.familySlideshow.cancelButton}
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ fontSize: '14px', color: '#cccccc', lineHeight: '1.5' }}>
                {currentImage.description || (
                  <em style={{ color: '#888' }}>{appConfig.ui.familySlideshow.noDescription}</em>
                )}
              </div>
            )}
          </div>

          {/* Tagged People Info */}
          {currentImage.people && currentImage.people.length > 0 && (
            <div style={imageInfoStyle}>
              <div style={{ fontWeight: 'bold', marginBottom: '10px', color: '#ffffff' }}>
                {appConfig.ui.familySlideshow.taggedPeopleTitle} ({currentImage.people.length})
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
        </div>
      </div>
    </div>
  );
};

  // Styles (matching PersonPictureSlideshow)
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
    zIndex: 9999
  };

  const modalStyle = {
    backgroundColor: '#1a1a1a',
    border: '1px solid #444',
    borderRadius: '8px',
    maxWidth: '90vw',
    maxHeight: '90vh',
    overflow: 'auto',
    display: 'flex',
    flexDirection: 'column'
  };

  const headerStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '15px 20px',
    borderBottom: '1px solid #444',
    backgroundColor: '#2a2a2a'
  };

  const closeButtonStyle = {
    background: 'none',
    border: 'none',
    color: '#ffffff',
    fontSize: '18px',
    cursor: 'pointer',
    padding: '5px'
  };

  const contentStyle = {
    padding: '20px',
    minHeight: '400px'
  };

  const imageContainerStyle = {
    position: 'relative',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: '20px'
  };

  const mainImageStyle = {
    maxWidth: '100%',
    maxHeight: '60vh',
    objectFit: 'contain',
    borderRadius: '8px'
  };

  const navButtonLeftStyle = {
    position: 'absolute',
    left: '-50px',
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'rgba(255, 255, 255, 0.1)',
    border: 'none',
    color: '#ffffff',
    fontSize: '24px',
    cursor: 'pointer',
    padding: '10px 15px',
    borderRadius: '50%',
    transition: 'background-color 0.2s'
  };

  const navButtonRightStyle = {
    position: 'absolute',
    right: '-50px',
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'rgba(255, 255, 255, 0.1)',
    border: 'none',
    color: '#ffffff',
    fontSize: '24px',
    cursor: 'pointer',
    padding: '10px 15px',
    borderRadius: '50%',
    transition: 'background-color 0.2s'
  };

  const imageInfoStyle = {
    marginBottom: '20px',
    padding: '15px',
    backgroundColor: '#2a2a2a',
    borderRadius: '8px',
    border: '1px solid #444'
  };

  const textareaStyle = {
    width: '100%',
    height: '80px',
    padding: '10px',
    border: '1px solid #444',
    borderRadius: '4px',
    backgroundColor: '#333',
    color: '#ffffff',
    resize: 'vertical'
  };

  const buttonContainerStyle = {
    display: 'flex',
    gap: '10px',
    marginTop: '10px'
  };

  const saveButtonStyle = {
    padding: '8px 16px',
    backgroundColor: '#4CAF50',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer'
  };

  const cancelButtonStyle = {
    padding: '8px 16px',
    backgroundColor: '#666',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer'
  };

  const peopleGridStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
    gap: '10px'
  };

  const thumbnailContainerStyle = {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '10px',
    marginTop: '20px',
    padding: '15px',
    backgroundColor: '#2a2a2a',
    borderRadius: '8px',
    border: '1px solid #444'
  };

  const thumbnailStyle = {
    width: '60px',
    height: '60px',
    objectFit: 'cover',
    borderRadius: '5px',
    cursor: 'pointer',
    transition: 'border 0.2s'
  };

export default FamilyPictureSlideshow;
