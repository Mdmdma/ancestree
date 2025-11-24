import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { appConfig } from './config';
import { subscribeToGeocodingUpdates } from './geocodingService';

// Custom marker icons
const createMarkerIcon = (isSelected, isHovered = false) => {
  const size = isSelected ? 36 : (isHovered ? 28 : 24);
  const color = isSelected ? '#FF5722' : '#4CAF50';
  const strokeColor = isSelected ? '#D32F2F' : '#2E7D32';
  const glow = isSelected ? `
    <defs>
      <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
        <feMerge> 
          <feMergeNode in="coloredBlur"/>
          <feMergeNode in="SourceGraphic"/> 
        </feMerge>
      </filter>
    </defs>
  ` : '';
  
  const innerCircles = isSelected ? `
    <circle cx="16" cy="11.33" r="2" fill="#FF5722"/>
    <circle cx="16" cy="11.33" r="1" fill="white" opacity="0.8"/>
  ` : '';

  const svgIcon = `
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      ${glow}
      <path d="M16 2C10.84 2 6.67 6.17 6.67 11.33c0 7 9.33 17.33 9.33 17.33s9.33-10.33 9.33-17.33C25.33 6.17 21.16 2 16 2z" 
            fill="${color}" 
            stroke="${strokeColor}" 
            stroke-width="2"
            filter="${isSelected ? 'url(#glow)' : 'none'}"/>
      <circle cx="16" cy="11.33" r="3.33" fill="white"/>
      ${innerCircles}
    </svg>
  `;

  return L.divIcon({
    html: svgIcon,
    className: 'custom-marker-icon',
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    popupAnchor: [0, -size]
  });
};

// Component to handle map animations and updates without recreating the map
const MapController = ({ locations, selectedNode, onPersonSelect, setMapInstance }) => {
  const map = useMap();
  const markersRef = useRef({});
  const [hoveredMarkerId, setHoveredMarkerId] = useState(null);
  const previousSelectedRef = useRef(null);

  // Store map instance for parent component
  useEffect(() => {
    if (setMapInstance) {
      setMapInstance(map);
    }
  }, [map, setMapInstance]);

  // Fit bounds when locations change significantly
  useEffect(() => {
    if (locations.length === 0) return;

    // Only fit bounds on initial load or when location count changes significantly
    const bounds = L.latLngBounds(locations.map(loc => [loc.latitude, loc.longitude]));
    
    if (!selectedNode) {
      map.fitBounds(bounds, { 
        padding: [50, 50],
        maxZoom: 15,
        animate: true,
        duration: 0.5
      });
    }
  }, [locations.length, map]); // Only depend on location count, not the full locations array

  // Handle selected node changes with smooth animation
  useEffect(() => {
    if (!selectedNode || locations.length === 0) return;

    const selectedLocation = locations.find(loc => loc.nodeId === selectedNode.id);
    if (!selectedLocation) return;

    const previousSelected = previousSelectedRef.current;
    previousSelectedRef.current = selectedNode.id;

    // Only animate if selection actually changed
    if (previousSelected !== selectedNode.id) {
      // Smooth pan to selected location
      map.flyTo(
        [selectedLocation.latitude, selectedLocation.longitude],
        Math.max(map.getZoom(), 13),
        {
          duration: 1,
          easeLinearity: 0.25
        }
      );

      // Bounce animation for the marker
      setTimeout(() => {
        const marker = markersRef.current[selectedNode.id];
        if (marker) {
          // Create bounce effect with CSS animation
          const markerElement = marker.getElement();
          if (markerElement) {
            markerElement.style.animation = 'none';
            setTimeout(() => {
              markerElement.style.animation = 'marker-bounce 0.7s ease-in-out 2';
            }, 10);
          }

          // Open popup briefly
          marker.openPopup();
          setTimeout(() => {
            marker.closePopup();
          }, 3000);
        }
      }, 300);
    }
  }, [selectedNode, locations, map]);

  // Render markers with memoization to prevent unnecessary rerenders
  return (
    <>
      {locations.map((location) => {
        const isSelected = selectedNode && selectedNode.id === location.nodeId;
        const isHovered = hoveredMarkerId === location.nodeId;
        
        return (
          <Marker
            key={location.nodeId}
            position={[location.latitude, location.longitude]}
            icon={createMarkerIcon(isSelected, isHovered)}
            ref={(ref) => {
              if (ref) {
                markersRef.current[location.nodeId] = ref;
              }
            }}
            eventHandlers={{
              click: () => {
                if (onPersonSelect) {
                  onPersonSelect(location.nodeId);
                }
              },
              mouseover: (e) => {
                setHoveredMarkerId(location.nodeId);
                if (!isSelected) {
                  const marker = e.target;
                  marker.setIcon(createMarkerIcon(false, true));
                }
              },
              mouseout: (e) => {
                setHoveredMarkerId(null);
                if (!isSelected) {
                  const marker = e.target;
                  marker.setIcon(createMarkerIcon(false, false));
                }
              }
            }}
            zIndexOffset={isSelected ? 1000 : 100}
          >
            <Popup>
              <div style={{ 
                padding: '10px', 
                fontFamily: 'Arial, sans-serif', 
                textAlign: 'center' 
              }}>
                <div style={{ 
                  fontWeight: 'bold', 
                  color: isSelected ? '#FF5722' : '#4CAF50', 
                  fontSize: '14px' 
                }}>
                  {appConfig.ui.mapView.selectedPersonAddress} {location.name} {location.surname}
                </div>
                <div style={{ 
                  fontSize: '12px', 
                  color: '#666', 
                  marginTop: '5px' 
                }}>
                  {location.address}
                </div>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </>
  );
};

const MapView = ({ nodes, selectedNode, onPersonSelect, onMapModeChange }) => {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [mapInstance, setMapInstance] = useState(null);

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

  // Load locations from nodes (memoized to prevent unnecessary recalculations)
  const loadLocations = useCallback(() => {
    setLoading(true);
    
    try {
      const nodesWithLocations = nodes.filter(node => 
        node.data.city && 
        node.data.city.trim() !== '' &&
        node.data.latitude !== null && 
        node.data.latitude !== undefined &&
        node.data.longitude !== null &&
        node.data.longitude !== undefined
      );

      if (nodesWithLocations.length === 0) {
        setLocations([]);
        setLoading(false);
        return;
      }

      const validLocations = nodesWithLocations.map(node => {
        const address = `${node.data.city || ''} ${node.data.zip || ''} ${node.data.country || ''}`.trim();
        
        return {
          nodeId: node.id,
          name: node.data.name || appConfig.ui.mapView.unknownName,
          surname: node.data.surname || '',
          address: address,
          latitude: parseFloat(node.data.latitude),
          longitude: parseFloat(node.data.longitude)
        };
      });
      
      console.log(`[MapView] Loaded ${validLocations.length} locations from cached coordinates`);
      setLocations(validLocations);
    } catch (error) {
      console.error('Error loading locations:', error);
    } finally {
      setLoading(false);
    }
  }, [nodes]);

  // Subscribe to geocoding updates
  useEffect(() => {
    console.log('[MapView] Subscribing to geocoding updates');
    
    const unsubscribe = subscribeToGeocodingUpdates((nodeId, success, coordinates) => {
      if (success && coordinates) {
        console.log(`[MapView] Geocoding completed for node ${nodeId}, reloading locations`);
        loadLocations();
      }
    });
    
    return () => {
      console.log('[MapView] Unsubscribing from geocoding updates');
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

  // Memoize the center position to prevent unnecessary map recreations
  const defaultCenter = useMemo(() => {
    if (locations.length > 0) {
      const avgLat = locations.reduce((sum, loc) => sum + loc.latitude, 0) / locations.length;
      const avgLng = locations.reduce((sum, loc) => sum + loc.longitude, 0) / locations.length;
      return [avgLat, avgLng];
    }
    return [51.1657, 10.4515]; // Center of Germany as default
  }, [locations.length]); // Only recalculate when location count changes

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
        
        {/* Show selected person's address prominently */}
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
                <div>
                  {selectedNode.data.city}
                  {selectedNode.data.zip && ` ${selectedNode.data.zip}`}
                  {selectedNode.data.country && `, ${selectedNode.data.country}`}
                </div>
              </div>
            ) : (
              <div style={{ fontSize: '14px', opacity: 0.7, fontStyle: 'italic' }}>
                {appConfig.ui.mapView.noAddressAvailable}
              </div>
            )}
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
            backgroundColor: '#09380dff',
            zIndex: 500
          }}>
            <div style={{ fontSize: '48px', marginBottom: '20px' }}>{appConfig.ui.mapView.mapIcon}</div>
            <h3>{appConfig.ui.mapView.noLocationsTitle}</h3>
            <p style={{ opacity: 0.8 }}>
              {appConfig.ui.mapView.noLocationsMessage}
            </p>
          </div>
        )}
        
        {locations.length > 0 && (
          <MapContainer
            center={defaultCenter}
            zoom={6}
            style={{ width: '100%', height: '100%', minHeight: '400px' }}
            scrollWheelZoom={true}
            zoomControl={true}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              maxZoom={19}
            />
            <MapController 
              locations={locations}
              selectedNode={selectedNode}
              onPersonSelect={onPersonSelect}
              setMapInstance={setMapInstance}
            />
          </MapContainer>
        )}
      </div>

      {/* Add CSS for marker bounce animation */}
      <style>{`
        .custom-marker-icon {
          background: none;
          border: none;
        }
        
        @keyframes marker-bounce {
          0%, 100% {
            transform: translateY(0);
          }
          25% {
            transform: translateY(-20px);
          }
          50% {
            transform: translateY(0);
          }
          75% {
            transform: translateY(-10px);
          }
        }
        
        .leaflet-container {
          background: #09380dff;
        }
        
        .leaflet-popup-content-wrapper {
          border-radius: 8px;
        }
        
        .leaflet-popup-tip {
          background: white;
        }
      `}</style>
    </div>
  );
};

export default MapView;
