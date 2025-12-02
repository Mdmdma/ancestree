/**
 * Application Configuration
 * 
 * This file provides backward compatibility with the old appConfig import pattern.
 * It re-exports the German locale as the default config for components that haven't
 * been migrated to use the i18n system yet.
 * 
 * For new code, prefer using:
 *   import { useLanguage } from './locales/LanguageContext';
 *   const { t, translations } = useLanguage();
 * 
 * Or for backward compatibility within components:
 *   import { useTranslations } from './locales';
 *   const appConfig = useTranslations();
 */

// Re-export German locale as appConfig for backward compatibility
// This ensures existing code continues to work while we migrate
import { de } from './locales/de';

export const appConfig = de;

// Also export individual sections for convenience
export const { header, ui } = de;

// Export everything from locales for easy access
export * from './locales';
