import {
  NODE_ENCRYPTED_FIELDS,
  NODE_DB_ENCRYPTED_COLUMNS,
  EDGE_ENCRYPTED_FIELDS,
  EDGE_DB_ENCRYPTED_COLUMNS,
  IMAGE_ENCRYPTED_FIELDS,
  IMAGE_DB_ENCRYPTED_COLUMNS,
  IMAGE_PEOPLE_ENCRYPTED_FIELDS,
  IMAGE_PEOPLE_DB_ENCRYPTED_COLUMNS,
  CHAT_MESSAGE_ENCRYPTED_FIELDS,
  CHAT_MESSAGE_DB_ENCRYPTED_COLUMNS,
  ADMIN_ENCRYPTED_FIELDS,
  ADMIN_DB_ENCRYPTED_COLUMNS,
  NEVER_ENCRYPT_FIELDS,
  getEncryptedFields,
  getEncryptedDbColumns,
  shouldEncryptField,
  camelToSnake,
  snakeToCamel,
} from '../../encryptionFieldDefinitions';

describe('encryptionFieldDefinitions', () => {
  describe('getEncryptedFields', () => {
    it('returns NODE_ENCRYPTED_FIELDS for "node"', () => {
      expect(getEncryptedFields('node')).toBe(NODE_ENCRYPTED_FIELDS);
    });

    it('returns NODE_ENCRYPTED_FIELDS for "person"', () => {
      expect(getEncryptedFields('person')).toBe(NODE_ENCRYPTED_FIELDS);
    });

    it('returns EDGE_ENCRYPTED_FIELDS for "edge"', () => {
      expect(getEncryptedFields('edge')).toBe(EDGE_ENCRYPTED_FIELDS);
    });

    it('returns IMAGE_ENCRYPTED_FIELDS for "image"', () => {
      expect(getEncryptedFields('image')).toBe(IMAGE_ENCRYPTED_FIELDS);
    });

    it('returns IMAGE_PEOPLE_ENCRYPTED_FIELDS for "image_people"', () => {
      expect(getEncryptedFields('image_people')).toBe(IMAGE_PEOPLE_ENCRYPTED_FIELDS);
    });

    it('returns IMAGE_PEOPLE_ENCRYPTED_FIELDS for "imagePeople"', () => {
      expect(getEncryptedFields('imagePeople')).toBe(IMAGE_PEOPLE_ENCRYPTED_FIELDS);
    });

    it('returns CHAT_MESSAGE_ENCRYPTED_FIELDS for "chat_message"', () => {
      expect(getEncryptedFields('chat_message')).toBe(CHAT_MESSAGE_ENCRYPTED_FIELDS);
    });

    it('returns CHAT_MESSAGE_ENCRYPTED_FIELDS for "chatMessage"', () => {
      expect(getEncryptedFields('chatMessage')).toBe(CHAT_MESSAGE_ENCRYPTED_FIELDS);
    });

    it('returns ADMIN_ENCRYPTED_FIELDS for "admin"', () => {
      expect(getEncryptedFields('admin')).toBe(ADMIN_ENCRYPTED_FIELDS);
    });

    it('returns ADMIN_ENCRYPTED_FIELDS for "admin_setting"', () => {
      expect(getEncryptedFields('admin_setting')).toBe(ADMIN_ENCRYPTED_FIELDS);
    });

    it('returns empty array for unknown data type', () => {
      expect(getEncryptedFields('unknown')).toEqual([]);
    });
  });

  describe('getEncryptedDbColumns', () => {
    it('returns NODE_DB_ENCRYPTED_COLUMNS for "node"', () => {
      expect(getEncryptedDbColumns('node')).toBe(NODE_DB_ENCRYPTED_COLUMNS);
    });

    it('returns NODE_DB_ENCRYPTED_COLUMNS for "person"', () => {
      expect(getEncryptedDbColumns('person')).toBe(NODE_DB_ENCRYPTED_COLUMNS);
    });

    it('returns EDGE_DB_ENCRYPTED_COLUMNS for "edge"', () => {
      expect(getEncryptedDbColumns('edge')).toBe(EDGE_DB_ENCRYPTED_COLUMNS);
    });

    it('returns IMAGE_DB_ENCRYPTED_COLUMNS for "image"', () => {
      expect(getEncryptedDbColumns('image')).toBe(IMAGE_DB_ENCRYPTED_COLUMNS);
    });

    it('returns IMAGE_PEOPLE_DB_ENCRYPTED_COLUMNS for "image_people"', () => {
      expect(getEncryptedDbColumns('image_people')).toBe(IMAGE_PEOPLE_DB_ENCRYPTED_COLUMNS);
    });

    it('returns CHAT_MESSAGE_DB_ENCRYPTED_COLUMNS for "chat_message"', () => {
      expect(getEncryptedDbColumns('chat_message')).toBe(CHAT_MESSAGE_DB_ENCRYPTED_COLUMNS);
    });

    it('returns ADMIN_DB_ENCRYPTED_COLUMNS for "admin"', () => {
      expect(getEncryptedDbColumns('admin')).toBe(ADMIN_DB_ENCRYPTED_COLUMNS);
    });

    it('returns empty array for unknown data type', () => {
      expect(getEncryptedDbColumns('unknown')).toEqual([]);
    });
  });

  describe('NEVER_ENCRYPT_FIELDS', () => {
    it('includes id', () => {
      expect(NEVER_ENCRYPT_FIELDS).toContain('id');
    });

    it('includes source', () => {
      expect(NEVER_ENCRYPT_FIELDS).toContain('source');
    });

    it('includes target', () => {
      expect(NEVER_ENCRYPT_FIELDS).toContain('target');
    });

    it('includes image_id and person_id', () => {
      expect(NEVER_ENCRYPT_FIELDS).toContain('image_id');
      expect(NEVER_ENCRYPT_FIELDS).toContain('person_id');
    });

    it('includes camelCase variants imageId and personId', () => {
      expect(NEVER_ENCRYPT_FIELDS).toContain('imageId');
      expect(NEVER_ENCRYPT_FIELDS).toContain('personId');
    });
  });

  describe('shouldEncryptField', () => {
    it('returns true for a field in the encrypted list', () => {
      expect(shouldEncryptField('name', 'node')).toBe(true);
      expect(shouldEncryptField('surname', 'person')).toBe(true);
      expect(shouldEncryptField('sourceHandle', 'edge')).toBe(true);
      expect(shouldEncryptField('filename', 'image')).toBe(true);
    });

    it('returns false for NEVER_ENCRYPT_FIELDS', () => {
      expect(shouldEncryptField('id', 'node')).toBe(false);
      expect(shouldEncryptField('source', 'edge')).toBe(false);
      expect(shouldEncryptField('target', 'edge')).toBe(false);
      expect(shouldEncryptField('image_id', 'image')).toBe(false);
    });

    it('returns false for fields not in the encrypted list', () => {
      expect(shouldEncryptField('randomField', 'node')).toBe(false);
    });

    it('prioritizes NEVER_ENCRYPT over data type lists', () => {
      // Even if 'id' were somehow in a list, NEVER_ENCRYPT takes precedence
      expect(shouldEncryptField('id', 'node')).toBe(false);
    });
  });

  describe('camelToSnake', () => {
    it('converts camelCase to snake_case', () => {
      expect(camelToSnake('birthDate')).toBe('birth_date');
      expect(camelToSnake('maidenName')).toBe('maiden_name');
      expect(camelToSnake('sourceHandle')).toBe('source_handle');
    });

    it('handles strings with no uppercase letters', () => {
      expect(camelToSnake('name')).toBe('name');
      expect(camelToSnake('email')).toBe('email');
    });

    it('handles multiple uppercase letters', () => {
      expect(camelToSnake('lastGeocoded')).toBe('last_geocoded');
      expect(camelToSnake('originalFilename')).toBe('original_filename');
    });

    it('handles s3Key style naming', () => {
      expect(camelToSnake('s3Key')).toBe('s3_key');
      expect(camelToSnake('s3Url')).toBe('s3_url');
      expect(camelToSnake('thumbnailS3Key')).toBe('thumbnail_s3_key');
    });
  });

  describe('snakeToCamel', () => {
    it('converts snake_case to camelCase', () => {
      expect(snakeToCamel('birth_date')).toBe('birthDate');
      expect(snakeToCamel('maiden_name')).toBe('maidenName');
      expect(snakeToCamel('source_handle')).toBe('sourceHandle');
    });

    it('handles strings with no underscores', () => {
      expect(snakeToCamel('name')).toBe('name');
      expect(snakeToCamel('email')).toBe('email');
    });

    it('handles multiple underscores', () => {
      expect(snakeToCamel('last_geocoded')).toBe('lastGeocoded');
      expect(snakeToCamel('original_filename')).toBe('originalFilename');
    });

    it('handles s3 style naming', () => {
      expect(snakeToCamel('s3_key')).toBe('s3Key');
      expect(snakeToCamel('s3_url')).toBe('s3Url');
      expect(snakeToCamel('thumbnail_s3_key')).toBe('thumbnailS3Key');
    });
  });

  describe('field list consistency', () => {
    it('NODE_ENCRYPTED_FIELDS contains expected core fields', () => {
      const expected = ['name', 'surname', 'maidenName', 'birthDate', 'deathDate',
        'street', 'housenumber', 'city', 'zip', 'country', 'phone', 'email'];
      expected.forEach((field) => {
        expect(NODE_ENCRYPTED_FIELDS).toContain(field);
      });
    });

    it('EDGE_ENCRYPTED_FIELDS contains sourceHandle, targetHandle, type', () => {
      expect(EDGE_ENCRYPTED_FIELDS).toContain('sourceHandle');
      expect(EDGE_ENCRYPTED_FIELDS).toContain('targetHandle');
      expect(EDGE_ENCRYPTED_FIELDS).toContain('type');
    });

    it('EDGE_DB_ENCRYPTED_COLUMNS length equals EDGE_ENCRYPTED_FIELDS minus extra fields', () => {
      // Edge has label and notes in FIELDS but not in DB columns
      expect(EDGE_DB_ENCRYPTED_COLUMNS.length).toBeLessThanOrEqual(EDGE_ENCRYPTED_FIELDS.length);
    });

    // BUG: NODE_ENCRYPTED_FIELDS has more entries than NODE_DB_ENCRYPTED_COLUMNS.
    // Fields like biography, occupation, education, nationality, notes exist in
    // NODE_ENCRYPTED_FIELDS (camelCase) but have no corresponding column in
    // NODE_DB_ENCRYPTED_COLUMNS (snake_case). This means the arrays are out of sync.
    it.fails('NODE_ENCRYPTED_FIELDS length should equal NODE_DB_ENCRYPTED_COLUMNS length', () => {
      expect(NODE_ENCRYPTED_FIELDS.length).toBe(NODE_DB_ENCRYPTED_COLUMNS.length);
    });
  });
});
