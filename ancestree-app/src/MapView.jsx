import React, { useState, useEffect, useCallback } from 'react';
import { api } from './api';

const MapView = ({ nodes, selectedNode, onPersonSelect, onMapModeChange }) => {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [map, setMap] = useState(null);
  const [markers, setMarkers] = useState([]);

  // Notify parent when map mode is active
  useEffect(() => {
    if (onMapModeChange) {
      onMapModeChange(true);
    }
    // Cleanup when component unmounts
    return () => {
      if (onMapModeChange) {
        onMapModeChange(false);
      }
    };
  }, [onMapModeChange]);

  // Load and geocode addresses
  const loadLocations = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Filter nodes that have complete addresses
      const nodesWithAddresses = nodes.filter(node => 
        node.data.street && node.data.city && 
        (node.data.street.trim() !== '' || node.data.city.trim() !== '')
      );

      if (nodesWithAddresses.length === 0) {
        setLocations([]);
        setLoading(false);
        return;
      }

      // Geocode addresses
      const locationPromises = nodesWithAddresses.map(async (node) => {
        try {
          const address = `${node.data.street || ''} ${node.data.city || ''} ${node.data.zip || ''} ${node.data.country || ''}`.trim();
          const coordinates = await api.geocodeAddress(address);
          
          return {
            nodeId: node.id,
            name: node.data.name || 'Unknown',
            surname: node.data.surname || '',
            address: address,
            latitude: coordinates.lat,
            longitude: coordinates.lng
          };
        } catch (error) {
          console.error(`Failed to geocode address for ${node.data.name}:`, error);
          return null;
        }
      });

      const results = await Promise.all(locationPromises);
      const validLocations = results.filter(location => location !== null);
      
      setLocations(validLocations);
    } catch (error) {
      setError('Failed to load locations');
      console.error('Error loading locations:', error);
    } finally {
      setLoading(false);
    }
  }, [nodes]);

  // Initialize Google Maps
  const initializeMap = useCallback(() => {
    if (!window.google || locations.length === 0) return;

    const mapContainer = document.getElementById('google-map');
    if (!mapContainer) return;

    // Calculate bounds to fit all markers
    const bounds = new window.google.maps.LatLngBounds();
    locations.forEach(location => {
      bounds.extend(new window.google.maps.LatLng(location.latitude, location.longitude));
    });

    // Create map
    const newMap = new window.google.maps.Map(mapContainer, {
      zoom: 10,
      center: bounds.getCenter(),
      mapTypeId: window.google.maps.MapTypeId.ROADMAP,
      styles: [
        {
          featureType: 'all',
          elementType: 'geometry.fill',
          stylers: [{ color: '#2d5a2d' }]
        },
        {
          featureType: 'water',
          elementType: 'geometry',
          stylers: [{ color: '#1a3d1a' }]
        }
      ]
    });

    // Fit map to show all markers, unless a specific person is selected
    const selectedLocation = selectedNode ? locations.find(loc => loc.nodeId === selectedNode.id) : null;
    
    if (selectedLocation) {
      // Focus on the selected person's location with moderate zoom
      newMap.setCenter({ lat: selectedLocation.latitude, lng: selectedLocation.longitude });
      newMap.setZoom(13); // More moderate zoom level
    } else if (locations.length > 1) {
      newMap.fitBounds(bounds);
      // Ensure we don't zoom in too much for close locations
      setTimeout(() => {
        if (newMap.getZoom() > 15) {
          newMap.setZoom(15);
        }
      }, 100);
    } else if (locations.length === 1) {
      newMap.setCenter({ lat: locations[0].latitude, lng: locations[0].longitude });
      newMap.setZoom(13); // Moderate zoom for single location
    }

    // Create markers
    const newMarkers = locations.map(location => {
      const isSelected = selectedNode && selectedNode.id === location.nodeId;
      
      const marker = new window.google.maps.Marker({
        position: { lat: location.latitude, lng: location.longitude },
        map: newMap,
        title: `${location.name} ${location.surname}`,
        icon: {
          url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M16 2C10.84 2 6.67 6.17 6.67 11.33c0 7 9.33 17.33 9.33 17.33s9.33-10.33 9.33-17.33C25.33 6.17 21.16 2 16 2z" fill="${isSelected ? '#FF5722' : '#4CAF50'}" stroke="${isSelected ? '#D32F2F' : '#2E7D32'}" stroke-width="2"/>
              <circle cx="16" cy="11.33" r="3.33" fill="white"/>
              ${isSelected ? '<circle cx="16" cy="11.33" r="2" fill="#FF5722"/>' : ''}
            </svg>
          `),
          scaledSize: new window.google.maps.Size(isSelected ? 32 : 24, isSelected ? 32 : 24),
          anchor: new window.google.maps.Point(isSelected ? 16 : 12, isSelected ? 32 : 24)
        }
      });

      // Add click listener with slight delay to prevent flickering
      marker.addListener('click', () => {
        if (onPersonSelect) {
          // Small delay to prevent rapid successive calls
          setTimeout(() => {
            onPersonSelect(location.nodeId);
          }, 50);
        }
      });

      return marker;
    });

    setMap(newMap);
    setMarkers(newMarkers);
  }, [locations, onPersonSelect, selectedNode]);

  // Load Google Maps API
  useEffect(() => {
    const googleMapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    
    if (!googleMapsApiKey || googleMapsApiKey === 'your_google_maps_api_key_here') {
      setError('Google Maps API key not configured. Please check the setup documentation.');
      return;
    }

    if (!window.google) {
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${googleMapsApiKey}&libraries=geometry`;
      script.async = true;
      script.defer = true;
      script.onload = () => {
        initializeMap();
      };
      script.onerror = () => {
        setError('Failed to load Google Maps. Please check your API key and internet connection.');
      };
      document.head.appendChild(script);
    } else {
      initializeMap();
    }
  }, [initializeMap]);

  // Reload locations when nodes change
  useEffect(() => {
    loadLocations();
  }, [loadLocations]);

  // Update map focus when selected node changes
  useEffect(() => {
    if (map && selectedNode && locations.length > 0) {
      const selectedLocation = locations.find(loc => loc.nodeId === selectedNode.id);
      if (selectedLocation) {
        // Smoothly pan to the selected location without excessive zooming
        map.panTo({ lat: selectedLocation.latitude, lng: selectedLocation.longitude });
        // Only zoom in if we're zoomed out too far, and don't zoom excessively
        const currentZoom = map.getZoom();
        if (currentZoom < 12) {
          map.setZoom(13); // More moderate zoom level
        }
        
        // Update markers to show selection (but don't reinitialize entire map)
        updateMarkerSelection();
      }
    }
  }, [selectedNode, map, locations]);

  // Function to update marker selection without reinitializing the map
  const updateMarkerSelection = useCallback(() => {
    if (!window.google || !markers.length || !locations.length) return;

    markers.forEach((marker, index) => {
      const location = locations[index];
      const isSelected = selectedNode && selectedNode.id === location.nodeId;
      
      marker.setIcon({
        url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M16 2C10.84 2 6.67 6.17 6.67 11.33c0 7 9.33 17.33 9.33 17.33s9.33-10.33 9.33-17.33C25.33 6.17 21.16 2 16 2z" fill="${isSelected ? '#FF5722' : '#4CAF50'}" stroke="${isSelected ? '#D32F2F' : '#2E7D32'}" stroke-width="2"/>
            <circle cx="16" cy="11.33" r="3.33" fill="white"/>
            ${isSelected ? '<circle cx="16" cy="11.33" r="2" fill="#FF5722"/>' : ''}
          </svg>
        `),
        scaledSize: new window.google.maps.Size(isSelected ? 32 : 24, isSelected ? 32 : 24),
        anchor: new window.google.maps.Point(isSelected ? 16 : 12, isSelected ? 32 : 24)
      });
    });
  }, [markers, locations, selectedNode]);

  // Cleanup markers when component unmounts
  useEffect(() => {
    return () => {
      markers.forEach(marker => marker.setMap(null));
    };
  }, [markers]);

  const handleRefresh = () => {
    loadLocations();
  };

  return (
    <div style={{ 
      height: '100%', 
      display: 'flex', 
      flexDirection: 'column',
      backgroundColor: '#09380dff',
      color: 'white'
    }}>
      {/* Header */}
      <div style={{ 
        padding: '20px', 
        borderBottom: '1px solid #0a4b11ff',
        backgroundColor: '#0a4b11ff'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}>🗺️ Family Locations</h3>
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
            {loading ? '🔄' : '↻'} Refresh
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
              📍 {selectedNode.data.name} {selectedNode.data.surname}
            </div>
            {(selectedNode.data.street || selectedNode.data.city) ? (
              <div style={{ fontSize: '14px', opacity: 0.9 }}>
                {selectedNode.data.street && <div>{selectedNode.data.street}</div>}
                <div>
                  {selectedNode.data.city}
                  {selectedNode.data.zip && ` ${selectedNode.data.zip}`}
                  {selectedNode.data.country && `, ${selectedNode.data.country}`}
                </div>
              </div>
            ) : (
              <div style={{ fontSize: '14px', opacity: 0.7, fontStyle: 'italic' }}>
                No address information available
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
            {error.includes('API key not configured') && (
              <div style={{ marginTop: '10px', fontSize: '12px', opacity: 0.9 }}>
                <strong>Setup Instructions:</strong><br/>
                1. Get a Google Maps API key from Google Cloud Console<br/>
                2. Add it to your .env file as VITE_GOOGLE_MAPS_API_KEY<br/>
                3. Enable Maps JavaScript API and Geocoding API<br/>
                See GOOGLE_MAPS_SETUP.md for detailed instructions.
              </div>
            )}
          </div>
        )}
        
        <div style={{ fontSize: '14px', marginTop: '10px', opacity: 0.8 }}>
          Showing {locations.length} locations from {nodes.filter(n => n.data.street || n.data.city).length} people with addresses
        </div>
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
            🔄 Loading locations...
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
            padding: '20px'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '20px' }}>🗺️</div>
            <h3>No Locations Found</h3>
            <p style={{ opacity: 0.8 }}>
              Add street and city information to people in the editor to see them on the map.
            </p>
          </div>
        )}
        
        <div 
          id="google-map" 
          style={{ 
            width: '100%', 
            height: '100%',
            minHeight: '400px'
          }}
        />
      </div>

      {/* Location List */}
      {locations.length > 0 && (
        <div style={{ 
          maxHeight: '200px', 
          overflowY: 'auto', 
          borderTop: '1px solid #0a4b11ff',
          backgroundColor: '#0a4b11ff'
        }}>
          {locations.map((location, index) => (
            <div 
              key={location.nodeId}
              onClick={() => onPersonSelect && onPersonSelect(location.nodeId)}
              style={{
                padding: '12px 20px',
                borderBottom: index < locations.length - 1 ? '1px solid #09380dff' : 'none',
                cursor: 'pointer',
                transition: 'background-color 0.2s',
                backgroundColor: selectedNode?.id === location.nodeId ? '#09380dff' : 'transparent'
              }}
              onMouseEnter={(e) => e.target.style.backgroundColor = '#09380dff'}
              onMouseLeave={(e) => e.target.style.backgroundColor = selectedNode?.id === location.nodeId ? '#09380dff' : 'transparent'}
            >
              <div style={{ fontWeight: 'bold', fontSize: '14px' }}>
                📍 {location.name} {location.surname}
              </div>
              <div style={{ fontSize: '12px', opacity: 0.8, marginTop: '4px' }}>
                {location.address}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MapView;
