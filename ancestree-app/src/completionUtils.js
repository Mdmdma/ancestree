/**
 * Utility functions for checking node completion status based on required fields
 */

/**
 * Check if a person node has all required fields filled
 * @param {Object} nodeData - The node's data object
 * @param {Object} completionSettings - The completion settings configuration
 * @returns {Object} - { isComplete: boolean, missingFields: string[] }
 */
export const checkNodeCompletion = (nodeData, completionSettings) => {
  if (!nodeData || !completionSettings) {
    return { isComplete: true, missingFields: [] };
  }

  const missingFields = [];
  
  // Check if person is deceased (has death date)
  const isDeceased = nodeData.deathDate && nodeData.deathDate.trim() !== '';

  // Check name
  if (completionSettings.requireName && (!nodeData.name || nodeData.name.trim() === '')) {
    missingFields.push('name');
  }

  // Check surname
  if (completionSettings.requireSurname && (!nodeData.surname || nodeData.surname.trim() === '')) {
    missingFields.push('surname');
  }

  // Check maiden name
  if (completionSettings.requireMaidenName && (!nodeData.maidenName || nodeData.maidenName.trim() === '')) {
    missingFields.push('maidenName');
  }

  // Check birth date
  if (completionSettings.requireBirthDate && (!nodeData.birthDate || nodeData.birthDate.trim() === '')) {
    missingFields.push('birthDate');
  }

  // Check street fields (street AND house number both required)
  if (completionSettings.requireStreetFields) {
    if (!nodeData.street || nodeData.street.trim() === '') {
      missingFields.push('street');
    }
    if (!nodeData.housenumber || nodeData.housenumber.trim() === '') {
      missingFields.push('housenumber');
    }
  }

  // Check city and ZIP (both required)
  if (completionSettings.requireCityZip) {
    if (!nodeData.city || nodeData.city.trim() === '') {
      missingFields.push('city');
    }
    if (!nodeData.zip || nodeData.zip.trim() === '') {
      missingFields.push('zip');
    }
  }

  // Check country
  if (completionSettings.requireCountry && (!nodeData.country || nodeData.country.trim() === '')) {
    missingFields.push('country');
  }

  // Check phone (not required if person is deceased)
  if (completionSettings.requirePhone && !isDeceased && (!nodeData.phone || nodeData.phone.trim() === '')) {
    missingFields.push('phone');
  }

  // Check email (not required if person is deceased)
  if (completionSettings.requireEmail && !isDeceased && (!nodeData.email || nodeData.email.trim() === '')) {
    missingFields.push('email');
  }

  return {
    isComplete: missingFields.length === 0,
    missingFields
  };
};

/**
 * Check if a specific field is required and missing
 * @param {string} fieldName - The field name to check
 * @param {Object} nodeData - The node's data object
 * @param {Object} completionSettings - The completion settings configuration
 * @returns {boolean} - true if the field is required and missing
 */
export const isFieldIncomplete = (fieldName, nodeData, completionSettings) => {
  if (!nodeData || !completionSettings) {
    return false;
  }

  const { missingFields } = checkNodeCompletion(nodeData, completionSettings);
  return missingFields.includes(fieldName);
};

/**
 * Get human-readable field names for missing fields
 * @param {string[]} missingFields - Array of field names
 * @returns {string[]} - Array of human-readable field names
 */
export const getReadableFieldNames = (missingFields) => {
  const fieldNameMap = {
    name: 'Name',
    surname: 'Surname',
    maidenName: 'Maiden Name',
    birthDate: 'Birth Date',
    street: 'Street',
    housenumber: 'House Number',
    city: 'City',
    zip: 'ZIP Code',
    country: 'Country',
    phone: 'Phone',
    email: 'Email'
  };

  return missingFields.map(field => fieldNameMap[field] || field);
};
