import {
  SKIP_MARKER,
  SKIP_MARKER_PHONE,
  isSkipMarker,
  isFieldFilled,
  getDisplayValue,
  filterAddressForGeocoding,
} from '../../skipMarkerUtils';

describe('skipMarkerUtils', () => {
  describe('constants', () => {
    it('SKIP_MARKER is "000"', () => {
      expect(SKIP_MARKER).toBe('000');
    });

    it('SKIP_MARKER_PHONE is "+000"', () => {
      expect(SKIP_MARKER_PHONE).toBe('+000');
    });
  });

  describe('isSkipMarker', () => {
    it('returns true for "000"', () => {
      expect(isSkipMarker('000')).toBe(true);
    });

    it('returns true for "000" with surrounding whitespace', () => {
      expect(isSkipMarker('  000  ')).toBe(true);
    });

    it('returns true for "+000" when fieldType is "phone"', () => {
      expect(isSkipMarker('+000', 'phone')).toBe(true);
    });

    it('returns false for "+000" without phone fieldType', () => {
      expect(isSkipMarker('+000')).toBe(false);
    });

    it('returns false for "000" when fieldType is "phone"', () => {
      expect(isSkipMarker('000', 'phone')).toBe(false);
    });

    it('returns false for null', () => {
      expect(isSkipMarker(null)).toBe(false);
    });

    it('returns false for undefined', () => {
      expect(isSkipMarker(undefined)).toBe(false);
    });

    it('returns false for empty string', () => {
      expect(isSkipMarker('')).toBe(false);
    });

    it('returns false for non-string values', () => {
      expect(isSkipMarker(0)).toBe(false);
      expect(isSkipMarker(123)).toBe(false);
      expect(isSkipMarker(false)).toBe(false);
    });

    it('returns false for regular text', () => {
      expect(isSkipMarker('hello')).toBe(false);
      expect(isSkipMarker('0001')).toBe(false);
    });
  });

  describe('isFieldFilled', () => {
    it('returns false for null', () => {
      expect(isFieldFilled(null)).toBe(false);
    });

    it('returns false for undefined', () => {
      expect(isFieldFilled(undefined)).toBe(false);
    });

    it('returns false for empty string', () => {
      expect(isFieldFilled('')).toBe(false);
    });

    it('returns false for whitespace-only string', () => {
      expect(isFieldFilled('   ')).toBe(false);
    });

    it('returns false for "+" alone', () => {
      expect(isFieldFilled('+')).toBe(false);
    });

    it('returns false for non-string falsy values', () => {
      expect(isFieldFilled(0)).toBe(false);
      expect(isFieldFilled(false)).toBe(false);
    });

    it('returns true for skip marker "000"', () => {
      expect(isFieldFilled('000')).toBe(true);
    });

    it('returns true for phone skip marker "+000" with phone fieldType', () => {
      expect(isFieldFilled('+000', 'phone')).toBe(true);
    });

    it('returns true for regular non-empty string', () => {
      expect(isFieldFilled('John')).toBe(true);
      expect(isFieldFilled('some value')).toBe(true);
    });

    it('returns true for "+000" without phone fieldType (treated as regular value)', () => {
      expect(isFieldFilled('+000')).toBe(true);
    });
  });

  describe('getDisplayValue', () => {
    it('returns empty string for skip marker "000"', () => {
      expect(getDisplayValue('000')).toBe('');
    });

    it('returns empty string for phone skip marker "+000" with phone fieldType', () => {
      expect(getDisplayValue('+000', 'phone')).toBe('');
    });

    it('returns the original value for non-skip-marker strings', () => {
      expect(getDisplayValue('John')).toBe('John');
      expect(getDisplayValue('hello world')).toBe('hello world');
    });

    it('returns empty string for null', () => {
      expect(getDisplayValue(null)).toBe('');
    });

    it('returns empty string for undefined', () => {
      expect(getDisplayValue(undefined)).toBe('');
    });

    it('returns empty string for empty string', () => {
      expect(getDisplayValue('')).toBe('');
    });
  });

  describe('filterAddressForGeocoding', () => {
    it('passes through normal address fields', () => {
      const address = {
        street: 'Main St',
        housenumber: '42',
        city: 'Zurich',
        zip: '8000',
        country: 'Switzerland',
      };
      const result = filterAddressForGeocoding(address);
      expect(result).toEqual(address);
    });

    it('replaces skip markers with empty strings', () => {
      const address = {
        street: '000',
        housenumber: '000',
        city: 'Zurich',
        zip: '000',
        country: 'Switzerland',
      };
      const result = filterAddressForGeocoding(address);
      expect(result.street).toBe('');
      expect(result.housenumber).toBe('');
      expect(result.city).toBe('Zurich');
      expect(result.zip).toBe('');
      expect(result.country).toBe('Switzerland');
    });

    it('replaces missing fields with empty strings', () => {
      const result = filterAddressForGeocoding({});
      expect(result).toEqual({
        street: '',
        housenumber: '',
        city: '',
        zip: '',
        country: '',
      });
    });

    it('only processes known address fields', () => {
      const address = {
        street: 'Main St',
        housenumber: '1',
        city: 'Bern',
        zip: '3000',
        country: 'CH',
        extraField: 'should not appear',
      };
      const result = filterAddressForGeocoding(address);
      expect(result).not.toHaveProperty('extraField');
      expect(Object.keys(result)).toEqual(['street', 'housenumber', 'city', 'zip', 'country']);
    });
  });
});
