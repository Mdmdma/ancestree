/**
 * Locales Index
 * 
 * This file exports all available language translations and configuration.
 * To add a new language:
 * 1. Create a new file (e.g., fr.js) with the same structure as de.js or en.js
 * 2. Import it here
 * 3. Add it to the `locales` object
 * 4. Add metadata to `availableLanguages` array
 */

import { de } from './de';
import { en } from './en';

// All available locales
// Keys must match the language codes used in the _meta.code field
export const locales = {
  de,
  en,
  // Add new languages here:
  // fr: fr,
  // es: es,
  // it: it,
};

// Default/fallback language
export const defaultLanguage = 'de';

// Available languages with metadata for UI display
// This is derived from the locale files' _meta fields
export const availableLanguages = Object.values(locales).map(locale => ({
  code: locale._meta.code,
  name: locale._meta.name,
  flag: locale._meta.flag
}));

// Export individual locales for direct import if needed
export { de, en };

// Export the context and hooks
export { LanguageProvider, useLanguage, useTranslations, useTranslation } from './LanguageContext';

export default locales;
