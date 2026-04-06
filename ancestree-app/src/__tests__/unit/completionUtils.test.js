import {
  checkNodeCompletion,
  isFieldIncomplete,
  getReadableFieldNames,
} from '../../completionUtils';

describe('completionUtils', () => {
  // Helper: all settings enabled
  const allRequired = {
    requireName: true,
    requireSurname: true,
    requireMaidenName: true,
    requireBirthDate: true,
    requireStreetFields: true,
    requireCityZip: true,
    requireCountry: true,
    requirePhone: true,
    requireEmail: true,
    requireTaggedImage: true,
  };

  // Helper: no settings enabled
  const noneRequired = {
    requireName: false,
    requireSurname: false,
    requireMaidenName: false,
    requireBirthDate: false,
    requireStreetFields: false,
    requireCityZip: false,
    requireCountry: false,
    requirePhone: false,
    requireEmail: false,
    requireTaggedImage: false,
  };

  // Helper: a fully filled node
  const fullNode = {
    name: 'John',
    surname: 'Doe',
    maidenName: 'Smith',
    birthDate: '1990-01-15',
    deathDate: null,
    street: 'Main St',
    housenumber: '42',
    city: 'Zurich',
    zip: '8000',
    country: 'Switzerland',
    phone: '+41123456789',
    email: 'john@example.com',
    hasTaggedImage: true,
  };

  describe('checkNodeCompletion', () => {
    it('returns complete when nodeData is null', () => {
      const result = checkNodeCompletion(null, allRequired);
      expect(result.isComplete).toBe(true);
      expect(result.missingFields).toEqual([]);
    });

    it('returns complete when completionSettings is null', () => {
      const result = checkNodeCompletion(fullNode, null);
      expect(result.isComplete).toBe(true);
      expect(result.missingFields).toEqual([]);
    });

    it('returns complete when no fields are required', () => {
      const result = checkNodeCompletion({}, noneRequired);
      expect(result.isComplete).toBe(true);
      expect(result.missingFields).toEqual([]);
    });

    it('returns complete when all required fields are filled', () => {
      const result = checkNodeCompletion(fullNode, allRequired);
      expect(result.isComplete).toBe(true);
      expect(result.missingFields).toEqual([]);
    });

    it('detects missing name', () => {
      const result = checkNodeCompletion(
        { ...fullNode, name: null },
        { ...noneRequired, requireName: true }
      );
      expect(result.isComplete).toBe(false);
      expect(result.missingFields).toContain('name');
    });

    it('detects missing surname', () => {
      const result = checkNodeCompletion(
        { ...fullNode, surname: '' },
        { ...noneRequired, requireSurname: true }
      );
      expect(result.isComplete).toBe(false);
      expect(result.missingFields).toContain('surname');
    });

    it('detects missing maidenName', () => {
      const result = checkNodeCompletion(
        { ...fullNode, maidenName: null },
        { ...noneRequired, requireMaidenName: true }
      );
      expect(result.isComplete).toBe(false);
      expect(result.missingFields).toContain('maidenName');
    });

    it('detects missing birthDate', () => {
      const result = checkNodeCompletion(
        { ...fullNode, birthDate: '' },
        { ...noneRequired, requireBirthDate: true }
      );
      expect(result.isComplete).toBe(false);
      expect(result.missingFields).toContain('birthDate');
    });

    it('detects missing street fields (both street and housenumber)', () => {
      const result = checkNodeCompletion(
        { ...fullNode, street: null, housenumber: null },
        { ...noneRequired, requireStreetFields: true }
      );
      expect(result.isComplete).toBe(false);
      expect(result.missingFields).toContain('street');
      expect(result.missingFields).toContain('housenumber');
    });

    it('detects missing city and zip', () => {
      const result = checkNodeCompletion(
        { ...fullNode, city: null, zip: null },
        { ...noneRequired, requireCityZip: true }
      );
      expect(result.isComplete).toBe(false);
      expect(result.missingFields).toContain('city');
      expect(result.missingFields).toContain('zip');
    });

    it('detects missing country', () => {
      const result = checkNodeCompletion(
        { ...fullNode, country: null },
        { ...noneRequired, requireCountry: true }
      );
      expect(result.isComplete).toBe(false);
      expect(result.missingFields).toContain('country');
    });

    it('detects missing phone', () => {
      const result = checkNodeCompletion(
        { ...fullNode, phone: null },
        { ...noneRequired, requirePhone: true }
      );
      expect(result.isComplete).toBe(false);
      expect(result.missingFields).toContain('phone');
    });

    it('detects missing email', () => {
      const result = checkNodeCompletion(
        { ...fullNode, email: null },
        { ...noneRequired, requireEmail: true }
      );
      expect(result.isComplete).toBe(false);
      expect(result.missingFields).toContain('email');
    });

    it('detects missing taggedImage', () => {
      const result = checkNodeCompletion(
        { ...fullNode, hasTaggedImage: false },
        { ...noneRequired, requireTaggedImage: true }
      );
      expect(result.isComplete).toBe(false);
      expect(result.missingFields).toContain('taggedImage');
    });

    it('skip markers count as filled for all text fields', () => {
      const skipNode = {
        name: '000',
        surname: '000',
        maidenName: '000',
        birthDate: '000',
        street: '000',
        housenumber: '000',
        city: '000',
        zip: '000',
        country: '000',
        phone: '+000',
        email: '000',
        hasTaggedImage: true,
      };
      const result = checkNodeCompletion(skipNode, allRequired);
      expect(result.isComplete).toBe(true);
      expect(result.missingFields).toEqual([]);
    });

    describe('deceased person exemptions', () => {
      it('does not require phone for deceased person', () => {
        const deceased = { ...fullNode, deathDate: '2020-01-01', phone: null };
        const result = checkNodeCompletion(deceased, { ...noneRequired, requirePhone: true });
        expect(result.isComplete).toBe(true);
        expect(result.missingFields).not.toContain('phone');
      });

      it('does not require email for deceased person', () => {
        const deceased = { ...fullNode, deathDate: '2020-01-01', email: null };
        const result = checkNodeCompletion(deceased, { ...noneRequired, requireEmail: true });
        expect(result.isComplete).toBe(true);
        expect(result.missingFields).not.toContain('email');
      });

      it('still requires phone and email for living person', () => {
        const living = { ...fullNode, deathDate: null, phone: null, email: null };
        const result = checkNodeCompletion(living, {
          ...noneRequired,
          requirePhone: true,
          requireEmail: true,
        });
        expect(result.isComplete).toBe(false);
        expect(result.missingFields).toContain('phone');
        expect(result.missingFields).toContain('email');
      });
    });

    describe('deathDate skip marker bug', () => {
      // BUG: deathDate: '000' (skip marker) makes isDeceased true because
      // the check at line ~21 is:
      //   const isDeceased = nodeData.deathDate && nodeData.deathDate.trim() !== ''
      // "000".trim() !== '' is true, so isDeceased becomes true even though
      // a skip marker should NOT count as an actual death date.
      it.fails('skip marker "000" as deathDate should NOT make person deceased', () => {
        const node = {
          ...fullNode,
          deathDate: '000', // skip marker, NOT an actual death date
          phone: null,
          email: null,
        };
        const result = checkNodeCompletion(node, {
          ...noneRequired,
          requirePhone: true,
          requireEmail: true,
        });
        // If the bug were fixed, the person would NOT be considered deceased,
        // so phone and email would be required and missing.
        expect(result.isComplete).toBe(false);
        expect(result.missingFields).toContain('phone');
        expect(result.missingFields).toContain('email');
      });
    });
  });

  describe('isFieldIncomplete', () => {
    it('returns false when nodeData is null', () => {
      expect(isFieldIncomplete('name', null, allRequired)).toBe(false);
    });

    it('returns false when completionSettings is null', () => {
      expect(isFieldIncomplete('name', fullNode, null)).toBe(false);
    });

    it('returns true when a required field is missing', () => {
      const node = { ...fullNode, name: null };
      expect(isFieldIncomplete('name', node, { ...noneRequired, requireName: true })).toBe(true);
    });

    it('returns false when a required field is filled', () => {
      expect(isFieldIncomplete('name', fullNode, { ...noneRequired, requireName: true })).toBe(false);
    });

    it('returns false when a field is not required', () => {
      const node = { ...fullNode, name: null };
      expect(isFieldIncomplete('name', node, noneRequired)).toBe(false);
    });
  });

  describe('getReadableFieldNames', () => {
    it('maps known field names to readable labels', () => {
      const fields = ['name', 'surname', 'maidenName', 'birthDate', 'street', 'housenumber', 'city', 'zip', 'country', 'phone', 'email', 'taggedImage'];
      const readable = getReadableFieldNames(fields);
      expect(readable).toEqual([
        'Name', 'Surname', 'Maiden Name', 'Birth Date', 'Street',
        'House Number', 'City', 'ZIP Code', 'Country', 'Phone', 'Email', 'Tagged Image',
      ]);
    });

    it('returns the raw field name for unknown fields', () => {
      expect(getReadableFieldNames(['unknownField'])).toEqual(['unknownField']);
    });

    it('handles empty array', () => {
      expect(getReadableFieldNames([])).toEqual([]);
    });
  });
});
