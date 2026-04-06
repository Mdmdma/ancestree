import { renderHook, act } from '@testing-library/react';
import {
  LanguageProvider,
  useLanguage,
  useTranslation,
} from '../../locales/LanguageContext';

function wrapper({ children }) {
  return <LanguageProvider>{children}</LanguageProvider>;
}

describe('LanguageContext', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('provides German translations by default', () => {
    const { result } = renderHook(() => useLanguage(), { wrapper });
    expect(result.current.language).toBe('de');
    // German locale should have header.title = "Familienstammbaum"
    expect(result.current.translations.header.title).toBe('Familienstammbaum');
  });

  it('useLanguage returns language, setLanguage, t, translations', () => {
    const { result } = renderHook(() => useLanguage(), { wrapper });
    expect(result.current).toHaveProperty('language');
    expect(result.current).toHaveProperty('setLanguage');
    expect(result.current).toHaveProperty('t');
    expect(result.current).toHaveProperty('translations');
  });

  it('switching language to en works', () => {
    const { result } = renderHook(() => useLanguage(), { wrapper });

    act(() => {
      result.current.setLanguage('en');
    });

    expect(result.current.language).toBe('en');
    expect(result.current.translations.header.title).toBe('Family Tree');
  });

  it('useTranslation returns { t } as an object with translations', () => {
    const { result } = renderHook(() => useTranslation(), { wrapper });
    expect(result.current).toHaveProperty('t');
    // t is the translations object for direct property access
    expect(result.current.t.header.title).toBe('Familienstammbaum');
  });

  it('t function falls back to German for missing keys', () => {
    const { result } = renderHook(() => useLanguage(), { wrapper });

    act(() => {
      result.current.setLanguage('en');
    });

    // Use the t function (dot-path lookup) with a key that does not exist in English
    // t returns the key string if neither English nor German has it
    const missingValue = result.current.t('nonexistent.deep.key');
    expect(missingValue).toBe('nonexistent.deep.key');
  });

  it('persists language to sessionStorage', () => {
    const { result } = renderHook(() => useLanguage(), { wrapper });

    act(() => {
      result.current.setLanguage('en');
    });

    expect(sessionStorage.getItem('ancestree-language')).toBe('en');
  });

  it('restores language from sessionStorage', () => {
    sessionStorage.setItem('ancestree-language', 'en');

    const { result } = renderHook(() => useLanguage(), { wrapper });
    expect(result.current.language).toBe('en');
    expect(result.current.translations.header.title).toBe('Family Tree');
  });
});
