import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { appConfig } from './config';
import { subscribeToGeocodingUpdates } from './geocodingService';

// Fix Leaflet's default icon path issues with Vite
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjUiIGhlaWdodD0iNDEiIHZpZXdCb3g9IjAgMCAyNSA0MSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNMTIuNSAwQzUuNiAwIDAgNS42IDAgMTIuNWMwIDguNCAxMi41IDI4LjUgMTIuNSAyOC41UzI1IDIwLjkgMjUgMTIuNUMyNSA1LjYgMTkuNCAwIDEyLjUgMHoiIGZpbGw9IiM0Q0FGNTAiLz48Y2lyY2xlIGN4PSIxMi41IiBjeT0iMTIuNSIgcj0iNSIgZmlsbD0iI2ZmZiIvPjwvc3ZnPg==',
  iconUrl: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjUiIGhlaWdodD0iNDEiIHZpZXdCb3g9IjAgMCAyNSA0MSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNMTIuNSAwQzUuNiAwIDAgNS42IDAgMTIuNWMwIDguNCAxMi41IDI4LjUgMTIuNSAyOC41UzI1IDIwLjkgMjUgMTIuNUMyNSA1LjYgMTkuNCAwIDEyLjUgMHoiIGZpbGw9IiM0Q0FGNTAiLz48Y2lyY2xlIGN4PSIxMi41IiBjeT0iMTIuNSIgcj0iNSIgZmlsbD0iI2ZmZiIvPjwvc3ZnPg==',
  shadowUrl: null,
});

// Create custom marker icons
const createMarkerIcon = (isSelected, size = 'normal') => {
  const normalSize = size === 'normal' ? 24 : 28;
  const selectedSize = 36;
  const actualSize = isSelected ? selectedSize : normalSize;
  
  const color = isSelected ? '#FF5722' : '#4CAF50';
  const strokeColor = isSelected ? '#D32F2F' : '#2E7D32';
  const glowFilter = isSelected ? 'url(#glow)' : 'none';
  
  const svgIcon = `
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
          <feMerge> 
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/> 
          </feMerge>
        </filter>
      </defs>
      <path d="M16 2C10.84 2 6.67 6.17 6.67 11.33c0 7 9.33 17.33 9.33 17.33s9.33-10.33 9.33-17.33C25.33 6.17 21.16 2 16 2z" 
            fill="${color}" 
            stroke="${strokeColor}" 
            stroke-width="2"
            filter="${glowFilter}"/>
      <circle cx="16" cy="11.33" r="3.33" fill="white"/>
      ${isSelected ? '<circle cx="16" cy="11.33" r="2" fill="#FF5722"/>' : ''}
      ${isSelected ? '<circle cx="16" cy="11.33" r="1" fill="white" opacity="0.8"/>' : ''}
    </svg>
  `;
  
  return L.divIcon({
    html: svgIcon,
    className: 'custom-leaflet-marker',
    iconSize: [actualSize, actualSize],
    iconAnchor: [actualSize / 2, actualSize],
    popupAnchor: [0, -actualSize]
  });
};

// Component to handle map animations and updates
const MapController = ({ locations, selectedNode, onAnimationComplete }) => {
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
      ? locations.find(loc => loc.nodeId === selectedNode.id)
      : null;

    // Only pan/zoom if selection actually changed
    if (selectedLocation && previousSelectedRef.current !== selectedNode?.id) {
      console.log('[MapController] Panning to selected location:', selectedLocation);
      
      // Smooth fly to selected location with moderate zoom
      map.flyTo(
        [selectedLocation.latitude, selectedLocation.longitude],
        15, // Zoom level for individual marker view
        {
          duration: 0.8,
          easeLinearity: 0.25
        }
      );

      if (onAnimationComplete) {
        setTimeout(() => onAnimationComplete(selectedLocation), 800);
      }
    }

    previousSelectedRef.current = selectedNode?.id;
  }, [map, locations, selectedNode, onAnimationComplete]);

  return null;
};

// Custom marker component with animations
const AnimatedMarker = ({ 
  location, 
  isSelected, 
  onMarkerClick, 
  shouldBounce,
  onBounceComplete 
}) => {
  const [icon, setIcon] = useState(() => createMarkerIcon(isSelected));
  const [isHovered, setIsHovered] = useState(false);
  const markerRef = useRef(null);
  const bounceTimeoutRef = useRef(null);

  // Update icon when selection changes
  useEffect(() => {
    if (isSelected) {
      // Animate to selected state with intermediate size
      setIcon(createMarkerIcon(false, 'hover'));
      setTimeout(() => {
        setIcon(createMarkerIcon(true));
      }, 100);
    } else {
      setIcon(createMarkerIcon(false));
    }
  }, [isSelected]);

  // Handle bounce animation
  useEffect(() => {
    if (shouldBounce && markerRef.current) {
      const marker = markerRef.current;
      let bounces = 0;
      const maxBounces = 2;

      const doBounce = () => {
        if (bounces < maxBounces && marker) {
          const element = marker._icon;
          if (element) {
            element.style.transition = 'transform 0.3s ease-out';
            element.style.transform = 'translateY(-15px)';
            
            setTimeout(() => {
              if (element) {
                element.style.transform = 'translateY(0)';
              }
            }, 300);
            
            bounces++;
            if (bounces < maxBounces) {
              bounceTimeoutRef.current = setTimeout(doBounce, 600);
            } else if (onBounceComplete) {
              onBounceComplete();
            }
          }
        }
      };

      doBounce();
    }

    return () => {
      if (bounceTimeoutRef.current) {
        clearTimeout(bounceTimeoutRef.current);
      }
    };
  }, [shouldBounce, onBounceComplete]);

  // Stable callback references for event handlers
  const handleMouseOver = useCallback(() => {
    if (!isSelected) {
      setIsHovered(true);
      setIcon(createMarkerIcon(false, 'hover'));
    }
  }, [isSelected]);

  const handleMouseOut = useCallback(() => {
    if (!isSelected) {
      setIsHovered(false);
      setIcon(createMarkerIcon(false));
    }
  }, [isSelected]);

  const handleClick = useCallback(() => {
    console.log('[AnimatedMarker] Marker clicked:', location.nodeId);
    onMarkerClick(location.nodeId);
  }, [location.nodeId, onMarkerClick]);

  const eventHandlers = useMemo(() => ({
    click: handleClick,
    mouseover: handleMouseOver,
    mouseout: handleMouseOut
  }), [handleClick, handleMouseOver, handleMouseOut]);

  return (
    <Marker
      ref={markerRef}
      position={[location.latitude, location.longitude]}
      icon={icon}
      eventHandlers={eventHandlers}
      zIndexOffset={isSelected ? 1000 : 100}
    >
      {isSelected && (
        <Popup 
          autoClose={true}
          closeOnClick={false}
          closeButton={false}
          autoPan={false}
          className="custom-popup"
        >
          <div style={{
            padding: '10px',
            fontFamily: 'Arial, sans-serif',
            textAlign: 'center'
          }}>
            <div style={{
              fontWeight: 'bold',
              color: '#FF5722',
              fontSize: '14px',
              marginBottom: '5px'
            }}>
              {appConfig.ui.mapView.selectedPersonAddress} {location.name} {location.surname}
            </div>
            <div style={{
              fontSize: '12px',
              color: '#666'
            }}>
              {location.address}
            </div>
          </div>
        </Popup>
      )}
    </Marker>
  );
};

const OpenStreetMapView = ({ nodes, selectedNode, onPersonSelect, onMapModeChange }) => {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [bouncingMarkerId, setBouncingMarkerId] = useState(null);
  const mapRef = useRef(null);

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
      const validLocations = nodes
        .filter(node => 
          node.data.city && 
          node.data.city.trim() !== '' &&
          node.data.latitude !== null && 
          node.data.latitude !== undefined &&
          node.data.longitude !== null &&
          node.data.longitude !== undefined
        )
        .map(node => ({
          nodeId: node.id,
          name: node.data.name || appConfig.ui.mapView.unknownName,
          surname: node.data.surname || '',
          address: [node.data.city, node.data.zip, node.data.country]
            .filter(Boolean)
            .join(' ')
            .trim(),
          latitude: parseFloat(node.data.latitude),
          longitude: parseFloat(node.data.longitude)
        }))
        .filter(location => {
          // Filter out locations with invalid coordinates (NaN)
          // This can happen during encryption/decryption when data is temporarily in invalid state
          const isValid = !isNaN(location.latitude) && 
                         !isNaN(location.longitude) &&
                         isFinite(location.latitude) && 
                         isFinite(location.longitude);
          
          if (!isValid) {
            console.warn(`[OpenStreetMapView] Skipping location with invalid coordinates:`, {
              nodeId: location.nodeId,
              latitude: location.latitude,
              longitude: location.longitude
            });
          }
          
          return isValid;
        });

      console.log(`[OpenStreetMapView] Loaded ${validLocations.length} valid locations`);
      setLocations(validLocations);
    } catch (err) {
      setError(appConfig.ui.mapView.errors.failedToLoad);
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

  // Handle animation completion
  const handleAnimationComplete = useCallback((selectedLocation) => {
    setBouncingMarkerId(selectedLocation.nodeId);
    
    // Reset bouncing state after animation completes
    setTimeout(() => {
      setBouncingMarkerId(null);
    }, 2000);
  }, []);

  // Handle marker click
  const handleMarkerClick = useCallback((nodeId) => {
    // Prevent action if clicking already selected marker
    if (selectedNode && selectedNode.id === nodeId) {
      console.log('[OpenStreetMapView] Marker already selected, ignoring click');
      return;
    }
    
    console.log('[OpenStreetMapView] Marker clicked, selecting node:', nodeId);
    if (onPersonSelect) {
      onPersonSelect(nodeId);
    }
  }, [selectedNode, onPersonSelect]);

  const handleRefresh = () => {
    loadLocations();
  };

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
    <div style={{ 
      height: '100%', 
      display: 'flex', 
      flexDirection: 'column',
      backgroundColor: '#09380dff',
      color: 'white'
    }}>
      {/* Header */}
      <div className="mobile-hide-map-header" style={{ 
        padding: '20px', 
        borderBottom: '1px solid #0a4b11ff',
        backgroundColor: '#0a4b11ff'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}>{appConfig.ui.mapView.title}</h3>
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
            {loading ? '🔄' : '↻'} {appConfig.ui.mapView.refreshButton}
          </button>
        </div>
        
        {/* Selected person display */}
        {selectedNode && (
          <div style={{ 
            marginTop: '15px', 
            padding: '12px', 
            backgroundColor: '#09380dff', 
            borderRadius: '6px',
            border: '2px solid #4CAF50'
          }}>
            <div style={{ fontWeight: 'bold', fontSize: '16px', marginBottom: '8px' }}>
              {appConfig.ui.mapView.selectedPersonAddress} {selectedNode.data.name} {selectedNode.data.surname}
            </div>
            {selectedNode.data.city ? (
              <div style={{ fontSize: '14px', opacity: 0.9 }}>
                {selectedNode.data.city}
                {selectedNode.data.zip && ` ${selectedNode.data.zip}`}
                {selectedNode.data.country && `, ${selectedNode.data.country}`}
              </div>
            ) : (
              <div style={{ fontSize: '14px', opacity: 0.7, fontStyle: 'italic' }}>
                {appConfig.ui.mapView.noAddressAvailable}
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

      {/* Map Container */}
      <div style={{ flex: 1, position: 'relative' }}>
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
            {appConfig.ui.mapView.loadingLocations}
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
              {appConfig.ui.mapView.mapIcon}
            </div>
            <h3>{appConfig.ui.mapView.noLocationsTitle}</h3>
            <p style={{ opacity: 0.8 }}>
              {appConfig.ui.mapView.noLocationsMessage}
            </p>
          </div>
        )}
        
        {locations.length > 0 && (
          <MapContainer
            ref={mapRef}
            center={mapCenter}
            zoom={13}
            style={{ 
              width: '100%', 
              height: '100%',
              minHeight: '400px'
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
              onAnimationComplete={handleAnimationComplete}
            />
            
            {locations.map(location => (
              <AnimatedMarker
                key={location.nodeId}
                location={location}
                isSelected={selectedNode?.id === location.nodeId}
                onMarkerClick={handleMarkerClick}
                shouldBounce={bouncingMarkerId === location.nodeId}
                onBounceComplete={() => setBouncingMarkerId(null)}
              />
            ))}
          </MapContainer>
        )}
      </div>

      <style>{`
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
        }
        
        .custom-popup .leaflet-popup-content {
          margin: 0;
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
