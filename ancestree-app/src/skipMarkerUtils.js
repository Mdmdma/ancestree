/**
 * Utility functions for handling "000" skip markers
 * 
 * Skip markers are used to indicate that a field was intentionally left empty
 * by the user, marking the node as "complete" without requiring actual data.
 */

/**
 * The standard skip marker value
 */
export const SKIP_MARKER = '000';

/**
 * The skip marker for phone fields (with required + prefix)
 */
export const SKIP_MARKER_PHONE = '+000';

/**
 * Check if a value is a skip marker
 * @param {string} value - The value to check
 * @param {string} fieldType - Optional field type ('phone' for phone-specific check)
 * @returns {boolean} - true if the value is a skip marker
 */
export const isSkipMarker = (value, fieldType = null) => {
  if (!value || typeof value !== 'string') {
    return false;
  }
  
  const trimmedValue = value.trim();
  
  if (fieldType === 'phone') {
    return trimmedValue === SKIP_MARKER_PHONE;
  }
  
  return trimmedValue === SKIP_MARKER;
};

/**
 * Check if a field value should be considered "filled" for completion purposes
 * A field is filled if it has a non-empty value OR a skip marker
 * @param {string} value - The value to check
 * @param {string} fieldType - Optional field type ('phone' for phone-specific check)
 * @returns {boolean} - true if the field should be considered filled
 */
export const isFieldFilled = (value, fieldType = null) => {
  if (!value || typeof value !== 'string') {
    return false;
  }
  
  const trimmedValue = value.trim();
  
  // Empty string is not filled
  if (trimmedValue === '' || trimmedValue === '+') {
    return false;
  }
  
  // Skip marker counts as filled
  if (isSkipMarker(trimmedValue, fieldType)) {
    return true;
  }
  
  // Any other non-empty value is filled
  return true;
};

/**
 * Get the display value for a field, hiding skip markers
 * @param {string} value - The value to display
 * @param {string} fieldType - Optional field type ('phone' for phone-specific check)
 * @returns {string} - The value to display (empty string if skip marker)
 */
export const getDisplayValue = (value, fieldType = null) => {
  if (isSkipMarker(value, fieldType)) {
    return '';
  }
  return value || '';
};

/**
 * Filter out skip marker values from an address object for geocoding
 * @param {Object} addressData - Object with address fields
 * @returns {Object} - Address object with skip markers replaced with empty strings
 */
export const filterAddressForGeocoding = (addressData) => {
  const filtered = {};
  const addressFields = ['street', 'housenumber', 'city', 'zip', 'country'];
  
  for (const field of addressFields) {
    if (addressData[field] && !isSkipMarker(addressData[field])) {
      filtered[field] = addressData[field];
    } else {
      filtered[field] = '';
    }
  }
  
  return filtered;
};
