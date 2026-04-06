import {
  formatDateToGerman,
  formatDateToISO,
  formatDisplayDate,
  getBirthYear,
} from '../../dateUtils';

describe('dateUtils', () => {
  describe('formatDateToGerman', () => {
    it('converts ISO date to German format', () => {
      expect(formatDateToGerman('2024-03-15')).toBe('15.03.2024');
    });

    it('pads single-digit day and month', () => {
      expect(formatDateToGerman('1990-1-5')).toBe('05.01.1990');
    });

    it('returns empty string for null', () => {
      expect(formatDateToGerman(null)).toBe('');
    });

    it('returns empty string for undefined', () => {
      expect(formatDateToGerman(undefined)).toBe('');
    });

    it('returns empty string for empty string', () => {
      expect(formatDateToGerman('')).toBe('');
    });

    it('returns empty string for whitespace-only string', () => {
      expect(formatDateToGerman('   ')).toBe('');
    });

    it('returns skip marker as-is', () => {
      expect(formatDateToGerman('000')).toBe('000');
    });

    it('returns already-German-format date as-is', () => {
      expect(formatDateToGerman('15.03.2024')).toBe('15.03.2024');
    });
  });

  describe('formatDateToISO', () => {
    it('converts German date to ISO format', () => {
      expect(formatDateToISO('15.03.2024')).toBe('2024-03-15');
    });

    it('pads single-digit day and month', () => {
      expect(formatDateToISO('5.1.1990')).toBe('1990-01-05');
    });

    it('returns empty string for null', () => {
      expect(formatDateToISO(null)).toBe('');
    });

    it('returns empty string for undefined', () => {
      expect(formatDateToISO(undefined)).toBe('');
    });

    it('returns empty string for empty string', () => {
      expect(formatDateToISO('')).toBe('');
    });

    it('returns empty string for whitespace-only string', () => {
      expect(formatDateToISO('   ')).toBe('');
    });

    it('returns skip marker as-is', () => {
      expect(formatDateToISO('000')).toBe('000');
    });

    it('returns already-ISO-format date as-is', () => {
      expect(formatDateToISO('2024-03-15')).toBe('2024-03-15');
    });
  });

  describe('formatDisplayDate', () => {
    it('converts ISO date to German format for display', () => {
      expect(formatDisplayDate('2024-03-15')).toBe('15.03.2024');
    });

    it('returns German format date as-is', () => {
      expect(formatDisplayDate('15.03.2024')).toBe('15.03.2024');
    });

    it('returns empty string for null', () => {
      expect(formatDisplayDate(null)).toBe('');
    });

    it('returns empty string for undefined', () => {
      expect(formatDisplayDate(undefined)).toBe('');
    });

    it('returns empty string for empty string', () => {
      expect(formatDisplayDate('')).toBe('');
    });

    it('returns skip marker as-is', () => {
      expect(formatDisplayDate('000')).toBe('000');
    });
  });

  describe('getBirthYear', () => {
    it('extracts year from ISO date', () => {
      expect(getBirthYear('1990-05-20')).toBe(1990);
    });

    it('extracts year from German date', () => {
      expect(getBirthYear('20.05.1990')).toBe(1990);
    });

    it('returns null for null', () => {
      expect(getBirthYear(null)).toBeNull();
    });

    it('returns null for undefined', () => {
      expect(getBirthYear(undefined)).toBeNull();
    });

    it('returns null for skip marker', () => {
      expect(getBirthYear('000')).toBeNull();
    });

    it('returns null for non-numeric year in ISO format', () => {
      expect(getBirthYear('abcd-01-01')).toBeNull();
    });

    it('returns null for non-numeric year in German format', () => {
      expect(getBirthYear('01.01.abcd')).toBeNull();
    });

    it('returns null for string with no separators', () => {
      expect(getBirthYear('hello')).toBeNull();
    });
  });
});
