import React, { useState, useRef, useEffect } from 'react';
import { useLanguage } from '../locales/LanguageContext';

/**
 * Language Picker Component
 * A dropdown component for selecting the app language.
 * Uses Tailwind CSS for styling.
 * 
 * @param {Object} props
 * @param {string} props.className - Additional CSS classes
 * @param {boolean} props.showLabel - Whether to show the label text
 * @param {boolean} props.compact - Use compact/minimal styling
 */
export default function LanguagePicker({ className = '', showLabel = false, compact = false }) {
  const { language, setLanguage, availableLanguages, t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close dropdown on escape key
  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  const currentLanguage = availableLanguages.find(lang => lang.code === language);

  const handleSelect = (langCode) => {
    setLanguage(langCode);
    setIsOpen(false);
  };

  return (
    <div 
      ref={dropdownRef}
      className={`relative inline-block ${className}`}
    >
      {showLabel && (
        <label className="block text-sm font-medium text-gray-300 mb-1">
          {t('ui.languagePicker.label')}
        </label>
      )}
      
      {/* Dropdown Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`
          flex items-center justify-between gap-2
          ${compact 
            ? 'px-2 py-1 text-sm min-w-[80px]' 
            : 'px-3 py-2 text-sm min-w-[120px]'
          }
          bg-[#2c3e50] hover:bg-[#34495e]
          border border-[#4a5568] rounded-lg
          text-white font-medium
          transition-colors duration-200
          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50
        `}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={t('ui.languagePicker.selectLanguage')}
      >
        <span className="flex items-center gap-2">
          <span className="text-base">{currentLanguage?.flag}</span>
          {!compact && <span>{currentLanguage?.name}</span>}
        </span>
        <svg 
          className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div 
          className="
            absolute z-50 mt-1 w-full min-w-[140px]
            bg-[#2c3e50] border border-[#4a5568] rounded-lg
            shadow-lg overflow-hidden
          "
          role="listbox"
          aria-label={t('ui.languagePicker.selectLanguage')}
        >
          {availableLanguages.map((lang) => (
            <button
              key={lang.code}
              onClick={() => handleSelect(lang.code)}
              className={`
                w-full flex items-center gap-3 px-3 py-2
                text-left text-sm text-white
                transition-colors duration-150
                ${lang.code === language 
                  ? 'bg-[#3498db] hover:bg-[#2980b9]' 
                  : 'hover:bg-[#34495e]'
                }
              `}
              role="option"
              aria-selected={lang.code === language}
            >
              <span className="text-base">{lang.flag}</span>
              <span className="font-medium">{lang.name}</span>
              {lang.code === language && (
                <svg className="w-4 h-4 ml-auto" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
