import React, { useState, useEffect, useCallback } from 'react';
import { appConfig } from './config';
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
      // Filter nodes that have at least city information
      const nodesWithAddresses = nodes.filter(node => 
        node.data.city && node.data.city.trim() !== ''
      );

      if (nodesWithAddresses.length === 0) {
        setLocations([]);
        setLoading(false);
        return;
      }

      // Geocode addresses
      const locationPromises = nodesWithAddresses.map(async (node) => {
        try {
          const address = `${node.data.city || ''} ${node.data.zip || ''} ${node.data.country || ''}`.trim();
          const coordinates = await api.geocodeAddress(address);
          
          return {
            nodeId: node.id,
            name: node.data.name || appConfig.ui.mapView.unknownName,
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
      setError(appConfig.ui.mapView.errors.failedToLoad);
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
                    fill="${isSelected ? '#FF5722' : '#4CAF50'}" 
                    stroke="${isSelected ? '#D32F2F' : '#2E7D32'}" 
                    stroke-width="2"
                    filter="${isSelected ? 'url(#glow)' : 'none'}"/>
              <circle cx="16" cy="11.33" r="3.33" fill="white"/>
              ${isSelected ? '<circle cx="16" cy="11.33" r="2" fill="#FF5722"/>' : ''}
              ${isSelected ? '<circle cx="16" cy="11.33" r="1" fill="white" opacity="0.8"/>' : ''}
            </svg>
          `),
          scaledSize: new window.google.maps.Size(isSelected ? 36 : 24, isSelected ? 36 : 24),
          anchor: new window.google.maps.Point(isSelected ? 18 : 12, isSelected ? 36 : 24)
        },
        zIndex: isSelected ? 1000 : 100,
        animation: null // Ensure no initial animation
      });

      // Add hover effects for better interactivity
      marker.addListener('mouseover', () => {
        if (!isSelected) {
          marker.setIcon({
            ...marker.getIcon(),
            scaledSize: new window.google.maps.Size(28, 28),
            anchor: new window.google.maps.Point(14, 28)
          });
        }
      });

      marker.addListener('mouseout', () => {
        if (!isSelected) {
          marker.setIcon({
            ...marker.getIcon(),
            scaledSize: new window.google.maps.Size(24, 24),
            anchor: new window.google.maps.Point(12, 24)
          });
        }
      });

      // Add click listener with enhanced animation
      marker.addListener('click', () => {
        if (onPersonSelect) {
          // Add a subtle click animation
          marker.setAnimation(window.google.maps.Animation.DROP);
          setTimeout(() => {
            marker.setAnimation(null);
            onPersonSelect(location.nodeId);
          }, 100);
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
      setError(appConfig.ui.mapView.errors.apiKeyNotConfigured);
      return;
    }

    if (!window.google) {
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${googleMapsApiKey}&libraries=geometry&language=de&region=DE`;
      script.async = true;
      script.defer = true;
      script.onload = () => {
        initializeMap();
      };
      script.onerror = () => {
        setError(appConfig.ui.mapView.errors.googleMapsLoad);
      };
      document.head.appendChild(script);
    } else {
      initializeMap();
    }
  }, [initializeMap]);

  // Function to update marker selection without reinitializing the map
  const updateMarkerSelection = useCallback(() => {
    if (!window.google || !markers.length || !locations.length) return;

    markers.forEach((marker, index) => {
      const location = locations[index];
      const isSelected = selectedNode && selectedNode.id === location.nodeId;
      
      // Create smooth transition by temporarily scaling the marker
      const currentIcon = marker.getIcon();
      const newIcon = {
        url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
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
                  fill="${isSelected ? '#FF5722' : '#4CAF50'}" 
                  stroke="${isSelected ? '#D32F2F' : '#2E7D32'}" 
                  stroke-width="2"
                  filter="${isSelected ? 'url(#glow)' : 'none'}"/>
            <circle cx="16" cy="11.33" r="3.33" fill="white"/>
            ${isSelected ? '<circle cx="16" cy="11.33" r="2" fill="#FF5722"/>' : ''}
            ${isSelected ? '<circle cx="16" cy="11.33" r="1" fill="white" opacity="0.8"/>' : ''}
          </svg>
        `),
        scaledSize: new window.google.maps.Size(isSelected ? 36 : 24, isSelected ? 36 : 24),
        anchor: new window.google.maps.Point(isSelected ? 18 : 12, isSelected ? 36 : 24)
      };

      // Apply the new icon with a smooth transition effect
      if (isSelected && currentIcon?.scaledSize?.width !== newIcon.scaledSize.width) {
        // Animate the selection change with a brief scale effect
        const intermediateIcon = {
          ...newIcon,
          scaledSize: new window.google.maps.Size(28, 28),
          anchor: new window.google.maps.Point(14, 28)
        };
        
        marker.setIcon(intermediateIcon);
        
        // After a brief moment, set the final selected state
        setTimeout(() => {
          marker.setIcon(newIcon);
        }, 100);
      } else {
        marker.setIcon(newIcon);
      }
      
      // Add a subtle z-index change for selected markers
      if (isSelected) {
        marker.setZIndex(1000);
      } else {
        marker.setZIndex(100);
      }
    });
  }, [markers, locations, selectedNode]);

  // Animate the selected marker with a bounce effect
  const animateSelectedMarker = useCallback((selectedLocation) => {
    const selectedMarker = markers.find((marker, index) => {
      const location = locations[index];
      return location && location.nodeId === selectedLocation.nodeId;
    });

    if (selectedMarker) {
      // Create bounce animation
      let bounces = 0;
      const maxBounces = 2;
      
      const bounce = () => {
        if (bounces < maxBounces) {
          // Animate up
          selectedMarker.setAnimation(window.google.maps.Animation.BOUNCE);
          
          // Stop animation after one bounce cycle
          setTimeout(() => {
            selectedMarker.setAnimation(null);
            bounces++;
            if (bounces < maxBounces) {
              setTimeout(bounce, 200); // Delay between bounces
            }
          }, 700); // Duration of one bounce
        }
      };
      
      bounce();

      // Show a brief info window with smooth fade-in effect
      const infoWindow = new window.google.maps.InfoWindow({
        content: `
          <div style="
            padding: 10px; 
            font-family: Arial, sans-serif; 
            text-align: center;
            animation: fadeIn 0.3s ease-in-out;
          ">
            <div style="font-weight: bold; color: #FF5722; font-size: 14px;">
              ${appConfig.ui.mapView.selectedPersonAddress} ${selectedLocation.name} ${selectedLocation.surname}
            </div>
            <div style="font-size: 12px; color: #666; margin-top: 5px;">
              ${selectedLocation.address}
            </div>
          </div>
          <style>
            @keyframes fadeIn {
              from { opacity: 0; transform: scale(0.8); }
              to { opacity: 1; transform: scale(1); }
            }
          </style>
        `,
        position: { lat: selectedLocation.latitude, lng: selectedLocation.longitude }
      });

      // Open the info window
      infoWindow.open(map);

      // Auto-close after 3 seconds with fade-out effect
      setTimeout(() => {
        infoWindow.close();
      }, 3000);
    }
  }, [markers, locations, map]);

  // Smooth animation to selected location
  const animateToLocation = useCallback((selectedLocation) => {
    if (!map || !selectedLocation) return;

    const targetPosition = { lat: selectedLocation.latitude, lng: selectedLocation.longitude };
    const currentZoom = map.getZoom();
    const targetZoom = currentZoom < 12 ? 13 : Math.max(currentZoom, 12);

    // First, smoothly pan to the location
    map.panTo(targetPosition);

    // Then animate zoom if needed
    if (currentZoom !== targetZoom) {
      // Use smooth zoom animation
      const zoomDifference = Math.abs(targetZoom - currentZoom);
      const animationDuration = Math.min(zoomDifference * 200, 1000); // Max 1 second
      
      // Animate zoom smoothly
      const startZoom = currentZoom;
      const startTime = Date.now();
      
      const animateZoom = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / animationDuration, 1);
        
        // Use easing function for smooth animation
        const easeProgress = 1 - Math.pow(1 - progress, 3); // ease-out cubic
        const currentAnimatedZoom = startZoom + (targetZoom - startZoom) * easeProgress;
        
        map.setZoom(currentAnimatedZoom);
        
        if (progress < 1) {
          requestAnimationFrame(animateZoom);
        }
      };
      
      requestAnimationFrame(animateZoom);
    }

    // Update markers with animation after a short delay
    setTimeout(() => {
      updateMarkerSelection();
      // Add bounce animation to the selected marker
      animateSelectedMarker(selectedLocation);
    }, 300); // Delay to let pan animation settle
  }, [map, updateMarkerSelection, animateSelectedMarker]);

  // Reload locations when nodes change
  useEffect(() => {
    loadLocations();
  }, [loadLocations]);

  // Update map focus when selected node changes
  useEffect(() => {
    if (map && selectedNode && locations.length > 0) {
      const selectedLocation = locations.find(loc => loc.nodeId === selectedNode.id);
      if (selectedLocation) {
        animateToLocation(selectedLocation);
      }
    }
  }, [selectedNode, map, locations, animateToLocation]);

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
                <strong>{appConfig.ui.mapView.errors.setupInstructions.title}</strong><br/>
                {appConfig.ui.mapView.errors.setupInstructions.step1}<br/>
                {appConfig.ui.mapView.errors.setupInstructions.step2}<br/>
                {appConfig.ui.mapView.errors.setupInstructions.step3}<br/>
                {appConfig.ui.mapView.errors.setupInstructions.seeDocumentation}
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
            padding: '20px'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '20px' }}>{appConfig.ui.mapView.mapIcon}</div>
            <h3>{appConfig.ui.mapView.noLocationsTitle}</h3>
            <p style={{ opacity: 0.8 }}>
              {appConfig.ui.mapView.noLocationsMessage}
            </p>
          </div>
        )}
        
        <div 
          id="google-map"
          className="map-container" 
          style={{ 
            width: '100%', 
            height: '100%',
            minHeight: '400px'
          }}
        />
      </div>
    </div>
  );
};

export default MapView;
