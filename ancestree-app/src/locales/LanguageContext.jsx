import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { locales, defaultLanguage, availableLanguages } from './index';

// Create the language context
const LanguageContext = createContext(null);

/**
 * Language Provider Component
 * Wraps the app and provides language state and translation function
 */
export function LanguageProvider({ children }) {
  // Initialize language from sessionStorage or default
  const [language, setLanguageState] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = sessionStorage.getItem('ancestree-language');
      if (stored && locales[stored]) {
        return stored;
      }
    }
    return defaultLanguage;
  });

  // Set language and persist to session storage
  const setLanguage = useCallback((lang) => {
    if (locales[lang]) {
      setLanguageState(lang);
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('ancestree-language', lang);
      }
    } else {
      console.warn(`Language "${lang}" not available. Available languages:`, Object.keys(locales));
    }
  }, []);

  // Get current translations object
  const translations = useMemo(() => {
    return locales[language] || locales[defaultLanguage];
  }, [language]);

  // Translation function with fallback to German
  const t = useCallback((key) => {
    const keys = key.split('.');
    let value = translations;
    let fallbackValue = locales[defaultLanguage];

    // Navigate through the nested object
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        value = undefined;
        break;
      }
    }

    // If value not found, try fallback language
    if (value === undefined) {
      for (const k of keys) {
        if (fallbackValue && typeof fallbackValue === 'object' && k in fallbackValue) {
          fallbackValue = fallbackValue[k];
        } else {
          fallbackValue = undefined;
          break;
        }
      }
      value = fallbackValue;
    }

    // If still not found, return the key itself
    if (value === undefined) {
      console.warn(`Translation key not found: "${key}"`);
      return key;
    }

    return value;
  }, [translations]);

  // Context value
  const contextValue = useMemo(() => ({
    language,
    setLanguage,
    t,
    translations,
    availableLanguages
  }), [language, setLanguage, t, translations]);

  return (
    <LanguageContext.Provider value={contextValue}>
      {children}
    </LanguageContext.Provider>
  );
}

/**
 * Hook to access language context
 * @returns {{ language: string, setLanguage: (lang: string) => void, t: (key: string) => string, translations: object, availableLanguages: Array }}
 */
export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}

/**
 * Hook to get the translations object directly (for components that need the full object)
 * This is useful for backward compatibility with appConfig usage
 * Returns just the translations object
 */
export function useTranslations() {
  const { translations } = useLanguage();
  return translations;
}

/**
 * Hook for components that use the pattern: const { t } = useTranslation()
 * Returns { t } where t is the translations object for direct property access like t.header.title
 */
export function useTranslation() {
  const { translations } = useLanguage();
  return { t: translations };
}

export default LanguageContext;
