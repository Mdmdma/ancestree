import React, { useState, useEffect, useRef, useCallback } from 'react';
import { searchAddressSuggestions } from '../geocodingUtils';

/**
 * AddressAutocomplete Component
 * Provides unified address input with real-time suggestions from Photon API
 * Automatically splits selected address into separate fields
 */
const AddressAutocomplete = ({ 
  value, 
  onSelect, 
  placeholder = 'Type address (street, city, country)...',
  inputStyle = {},
  disabled = false 
}) => {
  const [inputValue, setInputValue] = useState(value || '');
  const [suggestions, setSuggestions] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [isLoading, setIsLoading] = useState(false);
  
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);
  const debounceTimerRef = useRef(null);
  const abortControllerRef = useRef(null);

  // Update input value when prop changes
  useEffect(() => {
    setInputValue(value || '');
  }, [value]);

  // Debounced search function
  const performSearch = useCallback(async (query) => {
    if (query.length < 3) {
      setSuggestions([]);
      setIsOpen(false);
      setIsLoading(false);
      return;
    }

    // Abort previous request if still pending
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    setIsLoading(true);
    abortControllerRef.current = new AbortController();

    try {
      const results = await searchAddressSuggestions(query, 3);
      setSuggestions(results);
      setIsOpen(results.length > 0);
      setSelectedIndex(-1);
    } catch (error) {
      console.error('[AddressAutocomplete] Search error:', error);
      setSuggestions([]);
      setIsOpen(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Handle input change with debouncing
  const handleInputChange = (e) => {
    const newValue = e.target.value;
    setInputValue(newValue);

    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Set new timer for debounced search
    debounceTimerRef.current = setTimeout(() => {
      performSearch(newValue);
    }, 300); // 300ms debounce
  };

  // Handle suggestion selection
  const handleSelectSuggestion = (suggestion) => {
    // Clear the input field after selection
    setInputValue('');
    setIsOpen(false);
    setSuggestions([]);
    setSelectedIndex(-1);

    // Call parent callback with parsed address components
    if (onSelect) {
      onSelect({
        street: suggestion.street,
        housenumber: suggestion.housenumber,
        city: suggestion.city,
        zip: suggestion.zip,
        country: suggestion.country,
        displayLabel: suggestion.displayLabel,
        latitude: suggestion.latitude,
        longitude: suggestion.longitude
      });
    }
  };

  // Keyboard navigation
  const handleKeyDown = (e) => {
    if (!isOpen || suggestions.length === 0) {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < suggestions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
          handleSelectSuggestion(suggestions[selectedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        setSelectedIndex(-1);
        break;
      default:
        break;
    }
  };

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        dropdownRef.current && 
        !dropdownRef.current.contains(event.target) &&
        inputRef.current &&
        !inputRef.current.contains(event.target)
      ) {
        setIsOpen(false);
        setSelectedIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <input
        ref={inputRef}
        type="text"
        value={inputValue}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onFocus={() => {
          if (suggestions.length > 0) {
            setIsOpen(true);
          }
        }}
        placeholder={placeholder}
        disabled={disabled}
        style={{
          ...inputStyle,
          width: '100%',
          paddingRight: isLoading ? '30px' : inputStyle.paddingRight
        }}
        autoComplete="off"
      />
      
      {/* Loading indicator */}
      {isLoading && (
        <div style={{
          position: 'absolute',
          right: '10px',
          top: '50%',
          transform: 'translateY(-50%)',
          fontSize: '12px',
          color: '#999'
        }}>
          ...
        </div>
      )}

      {/* Suggestions dropdown */}
      {isOpen && suggestions.length > 0 && (
        <div
          ref={dropdownRef}
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            backgroundColor: 'white',
            border: '1px solid #ccc',
            borderTop: 'none',
            borderRadius: '0 0 4px 4px',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
            zIndex: 1000,
            maxHeight: '200px',
            overflowY: 'auto'
          }}
        >
          {suggestions.map((suggestion, index) => (
            <div
              key={suggestion.id}
              onClick={() => handleSelectSuggestion(suggestion)}
              onMouseEnter={() => setSelectedIndex(index)}
              style={{
                padding: '10px 12px',
                cursor: 'pointer',
                backgroundColor: selectedIndex === index ? '#e3f2fd' : 'white',
                borderBottom: index < suggestions.length - 1 ? '1px solid #f0f0f0' : 'none',
                transition: 'background-color 0.15s ease',
                fontSize: '14px',
                color: '#333'
              }}
            >
              <div style={{ fontWeight: '500' }}>
                {suggestion.displayLabel}
              </div>
              {suggestion.state && (
                <div style={{ fontSize: '12px', color: '#666', marginTop: '2px' }}>
                  {suggestion.state}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AddressAutocomplete;
