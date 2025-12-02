import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useTranslation } from './locales/LanguageContext';
import { subscribeToGeocodingUpdates } from './geocodingService';

// Fix Leaflet's default icon path issues with Vite
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjUiIGhlaWdodD0iNDEiIHZpZXdCb3g9IjAgMCAyNSA0MSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNMTIuNSAwQzUuNiAwIDAgNS42IDAgMTIuNWMwIDguNCAxMi41IDI4LjUgMTIuNSAyOC41UzI1IDIwLjkgMjUgMTIuNUMyNSA1LjYgMTkuNCAwIDEyLjUgMHoiIGZpbGw9IiM0Q0FGNTAiLz48Y2lyY2xlIGN4PSIxMi41IiBjeT0iMTIuNSIgcj0iNSIgZmlsbD0iI2ZmZiIvPjwvc3ZnPg==',
  iconUrl: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjUiIGhlaWdodD0iNDEiIHZpZXdCb3g9IjAgMCAyNSA0MSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNMTIuNSAwQzUuNiAwIDAgNS42IDAgMTIuNWMwIDguNCAxMi41IDI4LjUgMTIuNSAyOC41UzI1IDIwLjkgMjUgMTIuNUMyNSA1LjYgMTkuNCAwIDEyLjUgMHoiIGZpbGw9IiM0Q0FGNTAiLz48Y2lyY2xlIGN4PSIxMi41IiBjeT0iMTIuNSIgcj0iNSIgZmlsbD0iI2ZmZiIvPjwvc3ZnPg==',
  shadowUrl: null,
});

// Create custom marker icons - fixed size to prevent movement on zoom/selection
const createMarkerIcon = (isSelected, isHovered = false, hasMultiplePeople = false) => {
  // Fixed size to prevent marker position shifts
  const size = 32;
  const color = isSelected ? '#FF5722' : '#0da119ff';
  const strokeColor = isSelected ? '#D32F2F' : '#22cc1cff';
  const strokeWidth = isSelected ? 3 : 2;
  const opacity = isHovered ? 1 : 0.9;
  
  const glowFilter = isSelected ? `
    <defs>
      <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
        <feMerge> 
          <feMergeNode in="coloredBlur"/>
          <feMergeNode in="SourceGraphic"/> 
        </feMerge>
      </filter>
    </defs>
  ` : '<defs></defs>';
  
  const innerCircles = isSelected ? `
    <circle cx="16" cy="11.33" r="2" fill="#FF5722"/>
    <circle cx="16" cy="11.33" r="1" fill="white" opacity="0.8"/>
  ` : '';

  // Add a badge for multiple people at same location
  const badge = hasMultiplePeople ? `
    <circle cx="24" cy="6" r="5" fill="#2196F3" stroke="white" stroke-width="1"/>
    <text x="24" y="8.5" text-anchor="middle" font-size="8" fill="white" font-weight="bold">+</text>
  ` : '';
  
  const svgIcon = `
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      ${glowFilter}
      <path d="M16 2C10.84 2 6.67 6.17 6.67 11.33c0 7 9.33 17.33 9.33 17.33s9.33-10.33 9.33-17.33C25.33 6.17 21.16 2 16 2z" 
            fill="${color}" 
            stroke="${strokeColor}" 
            stroke-width="${strokeWidth}"
            opacity="${opacity}"
            filter="${isSelected ? 'url(#glow)' : 'none'}"/>
      <circle cx="16" cy="11.33" r="3.33" fill="white"/>
      ${innerCircles}
      ${badge}
    </svg>
  `;
  
  return L.divIcon({
    html: svgIcon,
    className: 'custom-leaflet-marker',
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    popupAnchor: [0, -size]
  });
};

// Component to handle map animations and updates
const MapController = ({ locations, selectedNode }) => {
  const map = useMap();
  const previousSelectedRef = useRef(null);
  const isInitializedRef = useRef(false);

  useEffect(() => {
    if (!map || locations.length === 0) return;

    // Initial bounds fitting
    if (!isInitializedRef.current) {
      const bounds = L.latLngBounds(
        locations.map(loc => [loc.latitude, loc.longitude])
      );
      
      if (locations.length === 1) {
        map.setView([locations[0].latitude, locations[0].longitude], 13, {
          animate: false
        });
      } else {
        map.fitBounds(bounds, { 
          padding: [50, 50],
          maxZoom: 15,
          animate: false
        });
      }
      
      isInitializedRef.current = true;
      return;
    }

    // Handle selection changes - pan and zoom map to selected marker
    const selectedLocation = selectedNode 
      ? locations.find(loc => loc.people.some(p => p.nodeId === selectedNode.id))
      : null;

    // Only pan/zoom if selection actually changed
    if (selectedLocation && previousSelectedRef.current !== selectedNode?.id) {
      console.log('[MapController] Panning to selected location:', selectedLocation);
      
      // Smooth fly to selected location with moderate zoom
      map.flyTo(
        [selectedLocation.latitude, selectedLocation.longitude],
        Math.max(map.getZoom(), 10), // At least zoom 13, but don't zoom out if already closer
        {
          duration: 0.8,
          easeLinearity: 0.25
        }
      );
    }

    previousSelectedRef.current = selectedNode?.id;
  }, [map, locations, selectedNode]);

  return null;
};

// Custom marker component with popup behavior
const AnimatedMarker = ({ 
  location, 
  selectedNode,
  onPersonSelect
}) => {
  const markerRef = useRef(null);
  const hoverTimeoutRef = useRef(null);
  const clickedRef = useRef(false);
  const [isHovered, setIsHovered] = useState(false);

  // Determine if this location has the selected person
  const hasSelectedPerson = selectedNode && location.people.some(p => p.nodeId === selectedNode.id);
  const hasMultiplePeople = location.people.length > 1;

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

  // Reset clicked state when selection changes away from this marker
  useEffect(() => {
    if (!hasSelectedPerson) {
      clickedRef.current = false;
    }
  }, [hasSelectedPerson]);

  const handleMouseOver = useCallback(() => {
    setIsHovered(true);
    const marker = markerRef.current;
    
    if (marker && !clickedRef.current) {
      marker.openPopup();
      
      // Clear existing timeout
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
      
      // Close popup after 3 seconds if not clicked
      hoverTimeoutRef.current = setTimeout(() => {
        if (marker && !clickedRef.current) {
          marker.closePopup();
        }
      }, 3000);
    }
  }, []);

  const handleMouseOut = useCallback(() => {
    setIsHovered(false);
    // Don't clear the timeout - let the popup stay open for 3 seconds
    // Only if it wasn't clicked (clicking sets its own behavior)
  }, []);

  const handleClick = useCallback(() => {
    const marker = markerRef.current;
    clickedRef.current = true;
    
    // Clear hover timeout
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    
    // Open and keep popup open
    if (marker) {
      marker.openPopup();
    }
    
    // If single person, select them immediately
    if (location.people.length === 1 && onPersonSelect) {
      console.log('[OpenStreetMapView] Marker clicked, selecting person:', location.people[0].nodeId);
      onPersonSelect(location.people[0].nodeId);
    }
  }, [location.people, onPersonSelect]);

  const handlePopupClose = useCallback(() => {
    clickedRef.current = false;
    // Clear timeout when popup closes
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
  }, []);

  const eventHandlers = useMemo(() => ({
    click: handleClick,
    mouseover: handleMouseOver,
    mouseout: handleMouseOut,
    popupclose: handlePopupClose
  }), [handleClick, handleMouseOver, handleMouseOut, handlePopupClose]);

  // Create icon based on state
  const icon = useMemo(() => 
    createMarkerIcon(hasSelectedPerson, isHovered, hasMultiplePeople),
    [hasSelectedPerson, isHovered, hasMultiplePeople]
  );

  return (
    <Marker
      ref={markerRef}
      position={[location.latitude, location.longitude]}
      icon={icon}
      eventHandlers={eventHandlers}
      zIndexOffset={hasSelectedPerson ? 1000 : 100}
    >
      <Popup 
        closeButton={true}
        autoClose={false}
        closeOnClick={false}
        className="custom-popup"
        maxWidth={300}
      >
        <div style={{
          padding: '8px',
          fontFamily: 'Arial, sans-serif',
          minWidth: '180px',
          maxWidth: '280px'
        }}>
          <div style={{
            fontSize: '12px',
            color: '#666',
            marginBottom: '8px',
            borderBottom: '1px solid #eee',
            paddingBottom: '6px',
            wordWrap: 'break-word',
            overflowWrap: 'break-word',
            overflow: 'hidden'
          }}>
            📍 {location.address}
          </div>
          {location.people.map((person) => {
            const isPersonSelected = selectedNode && selectedNode.id === person.nodeId;
            return (
              <div
                key={person.nodeId}
                onClick={(e) => {
                  e.stopPropagation();
                  console.log('[OpenStreetMapView] Person card clicked:', person.nodeId, person.name, person.surname);
                  if (onPersonSelect) {
                    onPersonSelect(person.nodeId);
                  }
                }}
                style={{
                  padding: '6px 8px',
                  margin: '4px 0',
                  backgroundColor: isPersonSelected ? '#FF572220' : '#f5f5f5',
                  border: isPersonSelected ? '2px solid #FF5722' : '1px solid #ddd',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  fontWeight: isPersonSelected ? 'bold' : 'normal',
                  wordWrap: 'break-word',
                  overflowWrap: 'break-word',
                  overflow: 'hidden'
                }}
                onMouseEnter={(e) => {
                  if (!isPersonSelected) {
                    e.currentTarget.style.backgroundColor = '#e8f5e9';
                    e.currentTarget.style.borderColor = '#4CAF50';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isPersonSelected) {
                    e.currentTarget.style.backgroundColor = '#f5f5f5';
                    e.currentTarget.style.borderColor = '#ddd';
                  }
                }}
              >
                <div style={{
                  color: isPersonSelected ? '#FF5722' : '#333',
                  fontSize: '14px'
                }}>
                  {isPersonSelected && '👤 '}{person.name} {person.surname}
                </div>
              </div>
            );
          })}
          {hasMultiplePeople && (
            <div style={{
              fontSize: '11px',
              color: '#999',
              marginTop: '8px',
              textAlign: 'center',
              fontStyle: 'italic'
            }}>
              Click a name to select in tree
            </div>
          )}
        </div>
      </Popup>
    </Marker>
  );
};

const OpenStreetMapView = ({ nodes, selectedNode, onPersonSelect, onMapModeChange }) => {
  const { t } = useTranslation();
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const mapRef = useRef(null);
  const containerRef = useRef(null);

  // Notify parent when map mode is active
  useEffect(() => {
    if (onMapModeChange) {
      onMapModeChange(true);
    }
    return () => {
      if (onMapModeChange) {
        onMapModeChange(false);
      }
    };
  }, [onMapModeChange]);

  // Load locations from nodes with valid coordinates
  const loadLocations = useCallback(() => {
    setLoading(true);
    setError(null);

    try {
      const nodesWithLocations = nodes.filter(node =>
        node.type === 'person' && // Only include person nodes, not family nodes
        node.data.city &&
        node.data.city.trim() !== '' &&
        node.data.latitude !== null &&
        node.data.latitude !== undefined &&
        node.data.longitude !== null &&
        node.data.longitude !== undefined &&
        !isNaN(parseFloat(node.data.latitude)) &&
        !isNaN(parseFloat(node.data.longitude)) &&
        isFinite(parseFloat(node.data.latitude)) &&
        isFinite(parseFloat(node.data.longitude))
      );

      if (nodesWithLocations.length === 0) {
        setLocations([]);
        setLoading(false);
        return;
      }

      // Group people by coordinates (same location)
      const locationMap = new Map();

      nodesWithLocations.forEach(node => {
        const lat = parseFloat(node.data.latitude).toFixed(6); // ~11cm precision
        const lng = parseFloat(node.data.longitude).toFixed(6);
        const key = `${lat},${lng}`;
        const address = [node.data.city, node.data.zip, node.data.country]
          .filter(Boolean)
          .join(' ')
          .trim();

        if (!locationMap.has(key)) {
          locationMap.set(key, {
            key,
            latitude: parseFloat(node.data.latitude),
            longitude: parseFloat(node.data.longitude),
            address,
            people: []
          });
        }

        locationMap.get(key).people.push({
          nodeId: node.id,
          name: node.data.name || t.ui.mapView.unknownName,
          surname: node.data.surname || ''
        });
      });

      const groupedLocations = Array.from(locationMap.values());

      console.log(`[OpenStreetMapView] Loaded ${groupedLocations.length} unique locations with ${nodesWithLocations.length} people`);
      setLocations(groupedLocations);
    } catch (err) {
      setError(t.ui.mapView.errors.failedToLoad);
      console.error('Error loading locations:', err);
    } finally {
      setLoading(false);
    }
  }, [nodes]);

  // Subscribe to geocoding updates
  useEffect(() => {
    console.log('[OpenStreetMapView] Subscribing to geocoding updates');
    
    const unsubscribe = subscribeToGeocodingUpdates((nodeId, success, coordinates) => {
      if (success && coordinates) {
        console.log(`[OpenStreetMapView] Geocoding completed for node ${nodeId}, reloading`);
        loadLocations();
      }
    });
    
    return () => {
      console.log('[OpenStreetMapView] Unsubscribing from geocoding updates');
      unsubscribe();
    };
  }, [loadLocations]);

  // Load locations when nodes change
  useEffect(() => {
    loadLocations();
  }, [loadLocations]);

  const handleRefresh = () => {
    loadLocations();
  };

  // Fullscreen functionality
  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;

    if (!isFullscreen) {
      // Enter fullscreen
      if (containerRef.current.requestFullscreen) {
        containerRef.current.requestFullscreen();
      } else if (containerRef.current.webkitRequestFullscreen) {
        containerRef.current.webkitRequestFullscreen();
      } else if (containerRef.current.mozRequestFullScreen) {
        containerRef.current.mozRequestFullScreen();
      } else if (containerRef.current.msRequestFullscreen) {
        containerRef.current.msRequestFullscreen();
      }
      setIsFullscreen(true);
    } else {
      // Exit fullscreen
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      } else if (document.mozCancelFullScreen) {
        document.mozCancelFullScreen();
      } else if (document.msExitFullscreen) {
        document.msExitFullscreen();
      }
      setIsFullscreen(false);
    }
  }, [isFullscreen]);

  // Listen for fullscreen changes (e.g., user pressing ESC)
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isCurrentlyFullscreen = !!(
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.mozFullScreenElement ||
        document.msFullscreenElement
      );
      setIsFullscreen(isCurrentlyFullscreen);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, []);

  // Calculate center and zoom for initial map view
  const mapCenter = useMemo(() => {
    if (locations.length === 0) return [51.1657, 10.4515]; // Germany center
    if (locations.length === 1) {
      return [locations[0].latitude, locations[0].longitude];
    }
    
    const latSum = locations.reduce((sum, loc) => sum + loc.latitude, 0);
    const lngSum = locations.reduce((sum, loc) => sum + loc.longitude, 0);
    return [latSum / locations.length, lngSum / locations.length];
  }, [locations]);

  return (
    <div 
      ref={containerRef}
      className={isFullscreen ? 'map-fullscreen-container' : ''}
      style={{ 
        display: 'flex', 
        flexDirection: 'column',
        backgroundColor: isFullscreen ? '#000' : '#09380dff',
        color: 'white',
        position: isFullscreen ? 'fixed' : 'relative',
        top: isFullscreen ? 0 : 'auto',
        left: isFullscreen ? 0 : 'auto',
        right: isFullscreen ? 0 : 'auto',
        bottom: isFullscreen ? 0 : 'auto',
        zIndex: isFullscreen ? 9999 : 'auto',
        width: isFullscreen ? '100%' : '100%',
        height: isFullscreen ? '100%' : '100%',
        overflow: 'hidden'
      }}
    >
      {/* Header - hidden in fullscreen mode */}
      {!isFullscreen && (
        <div className="mobile-hide-map-header" style={{ 
        padding: '20px', 
        borderBottom: '1px solid #0a4b11ff',
        backgroundColor: '#0a4b11ff'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}>{t.ui.mapView.title}</h3>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button 
              onClick={handleRefresh}
              disabled={loading}
              style={{
                padding: '8px 16px',
                backgroundColor: '#4CAF50',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '14px'
              }}
            >
              {loading ? '🔄' : '↻'} {t.ui.mapView.refreshButton}
            </button>
          </div>
        </div>
        
        {/* Selected person display */}
        {selectedNode && (
          <div style={{ 
            marginTop: '15px', 
            padding: '12px', 
            backgroundColor: '#09380dff', 
            borderRadius: '6px',
            border: '2px solid #4CAF50',
            overflow: 'hidden',
            wordWrap: 'break-word',
            overflowWrap: 'break-word'
          }}>
            <div style={{ 
              fontWeight: 'bold', 
              fontSize: '16px', 
              marginBottom: '8px',
              wordWrap: 'break-word',
              overflowWrap: 'break-word'
            }}>
              {t.ui.mapView.selectedPersonAddress} {selectedNode.data.name} {selectedNode.data.surname}
            </div>
            {selectedNode.data.city ? (
              <div style={{ 
                fontSize: '14px', 
                opacity: 0.9,
                wordWrap: 'break-word',
                overflowWrap: 'break-word'
              }}>
                {selectedNode.data.city}
                {selectedNode.data.zip && ` ${selectedNode.data.zip}`}
                {selectedNode.data.country && `, ${selectedNode.data.country}`}
              </div>
            ) : (
              <div style={{ fontSize: '14px', opacity: 0.7, fontStyle: 'italic' }}>
                {t.ui.mapView.noAddressAvailable}
              </div>
            )}
          </div>
        )}
        
        {error && (
          <div style={{ 
            marginTop: '10px', 
            padding: '10px', 
            backgroundColor: '#d32f2f', 
            borderRadius: '4px',
            fontSize: '14px'
          }}>
            {error}
          </div>
        )}
      </div>
      )}

      {/* Map Container */}
      <div 
        className={isFullscreen ? 'map-fullscreen-inner' : ''}
        style={{ 
          flex: 1, 
          position: isFullscreen ? 'absolute' : 'relative',
          top: isFullscreen ? 0 : 'auto',
          left: isFullscreen ? 0 : 'auto',
          right: isFullscreen ? 0 : 'auto',
          bottom: isFullscreen ? 0 : 'auto',
          width: '100%',
          height: isFullscreen ? '100%' : 'auto',
          minHeight: isFullscreen ? '100%' : 'auto'
        }}
      >
        {/* Fullscreen button - overlaid on map */}
        <button
          onClick={toggleFullscreen}
          className="map-fullscreen-button"
          style={{
            position: 'absolute',
            top: '10px',
            right: '10px',
            zIndex: 1000,
            padding: '8px 12px',
            backgroundColor: 'rgba(33, 150, 243, 0.9)',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
            minWidth: '36px',
            minHeight: '36px'
          }}
          title={isFullscreen ? t.ui.mapView.fullscreenExit : t.ui.mapView.fullscreenEnter}
        >
          {isFullscreen ? '⊗' : '⛶'}
        </button>

        {loading && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            zIndex: 1000,
            color: 'white',
            fontSize: '18px'
          }}>
            {t.ui.mapView.loadingLocations}
          </div>
        )}
        
        {!loading && locations.length === 0 && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
            color: 'white',
            textAlign: 'center',
            padding: '20px',
            backgroundColor: '#09380dff'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '20px' }}>
              {t.ui.mapView.mapIcon}
            </div>
            <h3>{t.ui.mapView.noLocationsTitle}</h3>
            <p style={{ opacity: 0.8 }}>
              {t.ui.mapView.noLocationsMessage}
            </p>
          </div>
        )}
        
        {locations.length > 0 && (
          <MapContainer
            ref={mapRef}
            center={mapCenter}
            zoom={10}
            style={{ 
              width: '100%', 
              height: '100%',
              minHeight: isFullscreen ? '100%' : '400px',
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0
            }}
            zoomControl={true}
            scrollWheelZoom={true}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              maxZoom={19}
            />
            
            <MapController 
              locations={locations}
              selectedNode={selectedNode}
            />
            
            {locations.map(location => (
              <AnimatedMarker
                key={location.key}
                location={location}
                selectedNode={selectedNode}
                onPersonSelect={onPersonSelect}
              />
            ))}
          </MapContainer>
        )}
      </div>

      <style>{`
        /* Fullscreen container - ensure it covers everything */
        .map-fullscreen-container {
          position: fixed !important;
          top: 0 !important;
          left: 0 !important;
          right: 0 !important;
          bottom: 0 !important;
          width: 100vw !important;
          height: 100vh !important;
          height: 100dvh !important;
          z-index: 99999 !important;
          background: #000 !important;
        }
        
        .map-fullscreen-inner {
          position: absolute !important;
          top: 0 !important;
          left: 0 !important;
          right: 0 !important;
          bottom: 0 !important;
          width: 100% !important;
          height: 100% !important;
        }
        
        .map-fullscreen-container .leaflet-container {
          width: 100% !important;
          height: 100% !important;
          min-height: 100% !important;
        }

        .custom-leaflet-marker {
          background: transparent;
          border: none;
          cursor: pointer !important;
          pointer-events: auto !important;
        }
        
        .custom-leaflet-marker svg {
          cursor: pointer !important;
          pointer-events: auto !important;
        }
        
        .leaflet-marker-icon {
          cursor: pointer !important;
          pointer-events: auto !important;
        }
        
        .custom-popup .leaflet-popup-content-wrapper {
          background-color: white;
          border-radius: 8px;
          box-shadow: 0 3px 14px rgba(0,0,0,0.4);
          max-width: 300px;
          overflow: hidden;
        }
        
        .custom-popup .leaflet-popup-content {
          margin: 0;
          max-width: 300px;
          overflow: hidden;
          word-wrap: break-word;
          overflow-wrap: break-word;
        }
        
        .custom-popup .leaflet-popup-tip {
          background-color: white;
        }
        
        .leaflet-container {
          font-family: Arial, sans-serif;
        }
      `}</style>
    </div>
  );
};

export default OpenStreetMapView;
