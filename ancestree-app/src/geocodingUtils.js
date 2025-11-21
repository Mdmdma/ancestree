/**
 * Geocoding Utilities
 * Provides address hashing and Photon API geocoding functionality
 */

/**
 * Generate MD5 hash of address components
 * Used to detect when an address has changed and needs re-geocoding
 * @param {string} street - Street name
 * @param {string} housenumber - House number
 * @param {string} city - City name
 * @param {string} zip - ZIP/postal code
 * @param {string} country - Country name
 * @returns {Promise<string>} MD5 hash of the address
 */
export const generateAddressHash = async (street, housenumber, city, zip, country) => {
  // Create normalized address string
  const addressString = [street, housenumber, city, zip, country]
    .filter(Boolean)
    .map(part => part.toString().trim().toLowerCase())
    .join('|');
  
  if (!addressString) {
    return null;
  }
  
  // Use Web Crypto API to generate MD5 hash
  // Note: MD5 is not available in Web Crypto API, so we'll use SHA-256 and truncate
  // For true MD5, we'd need a library, but for change detection SHA-256 works fine
  const encoder = new TextEncoder();
  const data = encoder.encode(addressString);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  // Return first 32 characters to match MD5 length
  return hashHex.substring(0, 32);
};

/**
 * Geocode an address using Photon API (Komoot)
 * Now accepts all address fields for more accurate geocoding
 * @param {string} street - Street name
 * @param {string} housenumber - House number
 * @param {string} city - City name
 * @param {string} zip - ZIP/postal code
 * @param {string} country - Country name
 * @returns {Promise<{latitude: number, longitude: number}|null>} Coordinates or null if failed
 */
export const geocodeAddress = async (street, housenumber, city, zip, country) => {
  try {
    // Build query string from all address components for better accuracy
    const addressParts = [street, housenumber, city, zip, country].filter(Boolean);
    if (addressParts.length === 0) {
      return null;
    }
    
    const query = addressParts.join(' ');
    
    // Call Photon API with German language preference
    const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&lang=de&limit=1`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Photon API returned ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Check if we got results
    if (!data.features || data.features.length === 0) {
      console.warn(`[Geocoding] No results found for address: ${query}`);
      return null;
    }
    
    // Extract coordinates from first result
    const feature = data.features[0];
    const [longitude, latitude] = feature.geometry.coordinates;
    
    console.log(`[Geocoding] Successfully geocoded "${query}" to: ${latitude}, ${longitude}`);
    
    return {
      latitude,
      longitude
    };
  } catch (error) {
    console.error(`[Geocoding] Failed to geocode address:`, error.message);
    return null;
  }
};

/**
 * Search for address suggestions using Photon API autocomplete
 * @param {string} query - Partial address string (minimum 3 characters)
 * @param {number} limit - Number of suggestions to return (default: 3)
 * @returns {Promise<Array>} Array of address suggestions with parsed components
 */
export const searchAddressSuggestions = async (query, limit = 3) => {
  try {
    // Require minimum 3 characters
    if (!query || query.trim().length < 3) {
      return [];
    }
    
    const trimmedQuery = query.trim();
    const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(trimmedQuery)}&lang=de&limit=${limit}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Photon API returned ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (!data.features || data.features.length === 0) {
      return [];
    }
    
    // Parse and format suggestions
    return data.features.map((feature, index) => {
      const props = feature.properties;
      const [longitude, latitude] = feature.geometry.coordinates;
      
      // Extract address components from Photon response
      const street = props.street || '';
      const housenumber = props.housenumber || '';
      const city = props.city || props.town || props.village || '';
      const zip = props.postcode || '';
      const country = props.country || '';
      const state = props.state || '';
      
      // Build display label with available components
      const addressParts = [];
      if (street && housenumber) {
        addressParts.push(`${street} ${housenumber}`);
      } else if (street) {
        addressParts.push(street);
      }
      if (city) addressParts.push(city);
      if (zip) addressParts.push(zip);
      if (country) addressParts.push(country);
      
      const displayLabel = addressParts.join(', ') || 'Unknown location';
      
      return {
        id: `${feature.properties.osm_id || index}`,
        displayLabel,
        street,
        housenumber,
        city,
        zip,
        country,
        state,
        latitude,
        longitude,
        raw: feature // Keep raw data for debugging
      };
    });
  } catch (error) {
    console.error('[AddressAutocomplete] Search failed:', error.message);
    return [];
  }
};

/**
 * Simple rate limiter that ensures minimum delay between calls
 * @param {number} minDelayMs - Minimum delay in milliseconds between calls
 * @returns {Function} Function that returns a promise that resolves after the delay
 */
export const createRateLimiter = (minDelayMs) => {
  let lastCallTime = 0;
  
  return async () => {
    const now = Date.now();
    const timeSinceLastCall = now - lastCallTime;
    
    if (timeSinceLastCall < minDelayMs) {
      const delayNeeded = minDelayMs - timeSinceLastCall;
      await new Promise(resolve => setTimeout(resolve, delayNeeded));
    }
    
    lastCallTime = Date.now();
  };
};
