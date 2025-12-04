/**
 * Utility functions for checking node completion status based on required fields
 */

import { isFieldFilled } from './skipMarkerUtils';

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
  if (completionSettings.requireName && !isFieldFilled(nodeData.name)) {
    missingFields.push('name');
  }

  // Check surname
  if (completionSettings.requireSurname && !isFieldFilled(nodeData.surname)) {
    missingFields.push('surname');
  }

  // Check maiden name
  if (completionSettings.requireMaidenName && !isFieldFilled(nodeData.maidenName)) {
    missingFields.push('maidenName');
  }

  // Check birth date
  if (completionSettings.requireBirthDate && !isFieldFilled(nodeData.birthDate)) {
    missingFields.push('birthDate');
  }

  // Check street fields (street AND house number both required)
  if (completionSettings.requireStreetFields) {
    if (!isFieldFilled(nodeData.street)) {
      missingFields.push('street');
    }
    if (!isFieldFilled(nodeData.housenumber)) {
      missingFields.push('housenumber');
    }
  }

  // Check city and ZIP (both required)
  if (completionSettings.requireCityZip) {
    if (!isFieldFilled(nodeData.city)) {
      missingFields.push('city');
    }
    if (!isFieldFilled(nodeData.zip)) {
      missingFields.push('zip');
    }
  }

  // Check country
  if (completionSettings.requireCountry && !isFieldFilled(nodeData.country)) {
    missingFields.push('country');
  }

  // Check phone (not required if person is deceased)
  if (completionSettings.requirePhone && !isDeceased && !isFieldFilled(nodeData.phone, 'phone')) {
    missingFields.push('phone');
  }

  // Check email (not required if person is deceased)
  if (completionSettings.requireEmail && !isDeceased && !isFieldFilled(nodeData.email)) {
    missingFields.push('email');
  }

  // Check tagged image
  if (completionSettings.requireTaggedImage && !nodeData.hasTaggedImage) {
    missingFields.push('taggedImage');
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
    email: 'Email',
    taggedImage: 'Tagged Image'
  };

  return missingFields.map(field => fieldNameMap[field] || field);
};
