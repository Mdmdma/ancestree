/**
 * Comprehensive Field Definitions for Encryption
 * Defines which fields should be encrypted for each table
 */

/**
 * Node (Person) fields to encrypt
 * ALL text fields including location data
 */
export const NODE_ENCRYPTED_FIELDS = [
  // Personal information
  'name',
  'surname',
  'maidenName',  // Note: DB uses maiden_name, but data object uses maidenName
  
  // Dates
  'birthDate',
  'deathDate',
  
  // Location
  'city',
  'zip',
  'country',
  
  // Contact
  'phone',
  'email',
  
  // Coordinates (stored as strings for encryption)
  'latitude',
  'longitude',
  
  // Additional fields (if they exist)
  'biography',
  'occupation',
  'education',
  'nationality',
  'notes',
  'addressHash'  // Encrypt the address hash too
];

/**
 * Database column names for nodes (snake_case)
 * Maps to NODE_ENCRYPTED_FIELDS
 */
export const NODE_DB_ENCRYPTED_COLUMNS = [
  'name',
  'surname',
  'maiden_name',
  'birth_date',
  'death_date',
  'city',
  'zip',
  'country',
  'phone',
  'email',
  'latitude',  // Will be converted to string for encryption
  'longitude',  // Will be converted to string for encryption
  'address_hash'
];

/**
 * Edge fields to encrypt
 * Note: IDs are NOT encrypted (source, target, id)
 */
export const EDGE_ENCRYPTED_FIELDS = [
  'sourceHandle',
  'targetHandle',
  'type',
  'label',  // If edges have labels
  'notes'   // If edges have notes
];

/**
 * Database column names for edges
 */
export const EDGE_DB_ENCRYPTED_COLUMNS = [
  'source_handle',
  'target_handle',
  'type'
];

/**
 * Image fields to encrypt
 * Note: id, s3_key, s3_url are NOT encrypted (needed for file access)
 */
export const IMAGE_ENCRYPTED_FIELDS = [
  'filename',
  'originalFilename',
  'description',
  'uploadDate',  // Date as string
  'fileSize',    // Size as string
  'mimeType',
  'uploadedBy',
  'title',       // If images have titles
  'location',    // If images have location text
  'date',        // If images have date text
  'caption'      // If images have captions
];

/**
 * Database column names for images
 */
export const IMAGE_DB_ENCRYPTED_COLUMNS = [
  'filename',
  'original_filename',
  'description',
  'upload_date',
  'file_size',
  'mime_type',
  'uploaded_by'
];

/**
 * Image-People association fields to encrypt
 * Position coordinates as strings
 */
export const IMAGE_PEOPLE_ENCRYPTED_FIELDS = [
  'positionX',
  'positionY',
  'width',
  'height'
];

/**
 * Database column names for image_people
 */
export const IMAGE_PEOPLE_DB_ENCRYPTED_COLUMNS = [
  'position_x',
  'position_y',
  'width',
  'height'
];

/**
 * Chat message fields to encrypt
 * Note: id, image_id are NOT encrypted
 */
export const CHAT_MESSAGE_ENCRYPTED_FIELDS = [
  'userName',
  'message',
  'createdAt'
];

/**
 * Database column names for chat_messages
 */
export const CHAT_MESSAGE_DB_ENCRYPTED_COLUMNS = [
  'user_name',
  'message',
  'created_at'
];

/**
 * Get all fields that should be encrypted for a given data type
 */
export const getEncryptedFields = (dataType) => {
  switch (dataType) {
    case 'node':
    case 'person':
      return NODE_ENCRYPTED_FIELDS;
    case 'edge':
      return EDGE_ENCRYPTED_FIELDS;
    case 'image':
      return IMAGE_ENCRYPTED_FIELDS;
    case 'image_people':
    case 'imagePeople':
      return IMAGE_PEOPLE_ENCRYPTED_FIELDS;
    case 'chat_message':
    case 'chatMessage':
      return CHAT_MESSAGE_ENCRYPTED_FIELDS;
    default:
      console.warn(`Unknown data type for encryption: ${dataType}`);
      return [];
  }
};

/**
 * Get database column names for a given data type
 */
export const getEncryptedDbColumns = (dataType) => {
  switch (dataType) {
    case 'node':
    case 'person':
      return NODE_DB_ENCRYPTED_COLUMNS;
    case 'edge':
      return EDGE_DB_ENCRYPTED_COLUMNS;
    case 'image':
      return IMAGE_DB_ENCRYPTED_COLUMNS;
    case 'image_people':
    case 'imagePeople':
      return IMAGE_PEOPLE_DB_ENCRYPTED_COLUMNS;
    case 'chat_message':
    case 'chatMessage':
      return CHAT_MESSAGE_DB_ENCRYPTED_COLUMNS;
    default:
      console.warn(`Unknown data type for DB columns: ${dataType}`);
      return [];
  }
};

/**
 * Fields that should NEVER be encrypted
 * These are structural/reference fields needed for DB operations
 */
export const NEVER_ENCRYPT_FIELDS = [
  'id',
  'source',
  'target',
  'image_id',
  'person_id',
  'imageId',
  'personId',
  's3_key',
  's3_url',
  's3Key',
  's3Url',
  'preferred_image_id',
  'preferredImageId'
];

/**
 * Check if a field should be encrypted
 */
export const shouldEncryptField = (fieldName, dataType) => {
  // Never encrypt structural fields
  if (NEVER_ENCRYPT_FIELDS.includes(fieldName)) {
    return false;
  }
  
  const encryptedFields = getEncryptedFields(dataType);
  return encryptedFields.includes(fieldName);
};

/**
 * Convert camelCase to snake_case
 */
export const camelToSnake = (str) => {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
};

/**
 * Convert snake_case to camelCase
 */
export const snakeToCamel = (str) => {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
};
