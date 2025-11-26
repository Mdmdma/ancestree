/**
 * Utility functions for date formatting and conversion
 */

/**
 * Convert ISO date (YYYY-MM-DD) to German format (dd.mm.yyyy)
 * @param {string} isoDate - Date in YYYY-MM-DD format
 * @returns {string} - Date in dd.mm.yyyy format, or empty string if invalid
 */
export const formatDateToGerman = (isoDate) => {
  if (!isoDate || isoDate.trim() === '') {
    return '';
  }
  
  try {
    // Handle ISO format: YYYY-MM-DD
    const parts = isoDate.split('-');
    if (parts.length === 3) {
      const [year, month, day] = parts;
      return `${day.padStart(2, '0')}.${month.padStart(2, '0')}.${year}`;
    }
    
    // If already in German format, return as is
    if (isoDate.includes('.')) {
      return isoDate;
    }
    
    return isoDate;
  } catch (error) {
    console.error('Error formatting date:', error);
    return isoDate;
  }
};

/**
 * Convert German format (dd.mm.yyyy) to ISO date (YYYY-MM-DD)
 * @param {string} germanDate - Date in dd.mm.yyyy format
 * @returns {string} - Date in YYYY-MM-DD format, or empty string if invalid
 */
export const formatDateToISO = (germanDate) => {
  if (!germanDate || germanDate.trim() === '') {
    return '';
  }
  
  try {
    // Handle German format: dd.mm.yyyy
    const parts = germanDate.split('.');
    if (parts.length === 3) {
      const [day, month, year] = parts;
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
    
    // If already in ISO format, return as is
    if (germanDate.includes('-')) {
      return germanDate;
    }
    
    return germanDate;
  } catch (error) {
    console.error('Error converting date to ISO:', error);
    return germanDate;
  }
};

/**
 * Format a date for display in the UI (German format: dd.mm.yyyy)
 * @param {string} date - Date in any supported format
 * @returns {string} - Formatted date string
 */
export const formatDisplayDate = (date) => {
  if (!date || date.trim() === '') {
    return '';
  }
  
  // If it's already in German format, return as is
  if (date.includes('.')) {
    return date;
  }
  
  // Otherwise convert from ISO
  return formatDateToGerman(date);
};
