import React, { useRef, useState, useEffect } from 'react';
import Button from './Button';
import { formatDateToGerman, formatDateToISO } from '../dateUtils';
import { isSkipMarker, SKIP_MARKER } from '../skipMarkerUtils';

/**
 * Reusable DateInput component with consistent styling
 * Features:
 * - Date displayed in dd.mm.yyyy format
 * - Text input with format enforcement
 * - Calendar button to open native date picker
 * - Clear button for resetting date
 * - Error state styling
 * - Optional helper text
 * - Read-only mode
 * - Tailwind CSS based
 */
const DateInput = ({
  label,
  value,
  onChange,
  error = '',
  helperText = '',
  readOnly = false,
  showClearButton = false,
  onClear,
  className = '',
  ...props
}) => {
  const hiddenDateInputRef = useRef(null);
  
  // Convert ISO date to German format for display, or keep as-is if already German
  const getDisplayValue = (val) => {
    if (!val) return '';
    // If it's a skip marker, return as-is
    if (isSkipMarker(val)) return val;
    // If already in German format (contains dots), return as-is
    if (val.includes('.')) return val;
    // Convert from ISO to German format
    return formatDateToGerman(val);
  };
  
  // Local state for the text input (German format)
  const [displayValue, setDisplayValue] = useState(getDisplayValue(value));
  
  // Sync displayValue when external value changes
  useEffect(() => {
    setDisplayValue(getDisplayValue(value));
  }, [value]);

  const handleClear = () => {
    setDisplayValue('');
    if (onClear) {
      onClear();
    } else if (onChange) {
      onChange({ target: { value: '' } });
    }
  };

  // Handle text input change with format enforcement
  const handleTextChange = (e) => {
    let input = e.target.value;
    
    // Check for skip marker - allow "000" to be entered and saved directly
    if (input === SKIP_MARKER || input === '00' || input === '0') {
      setDisplayValue(input);
      // Only propagate complete skip marker
      if (input === SKIP_MARKER) {
        if (onChange) {
          onChange({ target: { value: SKIP_MARKER } });
        }
      }
      return;
    }
    
    // Remove any non-digit and non-dot characters
    input = input.replace(/[^\d.]/g, '');
    
    // Auto-insert dots after day and month
    if (input.length === 2 && !input.includes('.')) {
      input = input + '.';
    } else if (input.length === 5 && input.charAt(2) === '.' && input.indexOf('.', 3) === -1) {
      input = input + '.';
    }
    
    // Limit to 10 characters (dd.mm.yyyy)
    if (input.length > 10) {
      input = input.substring(0, 10);
    }
    
    setDisplayValue(input);
    
    // Only propagate to parent if we have a complete date or empty
    if (input === '' || input.length === 10) {
      const isoDate = input ? formatDateToISO(input) : '';
      if (onChange) {
        onChange({ target: { value: isoDate } });
      }
    }
  };
  
  // Handle blur to validate and format incomplete dates
  const handleBlur = () => {
    // Skip marker is valid as-is
    if (isSkipMarker(displayValue)) {
      return;
    }
    
    // If incomplete, clear the display
    if (displayValue && displayValue.length !== 10) {
      // Try to parse partial input
      const parts = displayValue.split('.');
      if (parts.length === 3 && parts[0] && parts[1] && parts[2] && parts[2].length === 4) {
        // Complete date with correct format
        const formatted = `${parts[0].padStart(2, '0')}.${parts[1].padStart(2, '0')}.${parts[2]}`;
        setDisplayValue(formatted);
        const isoDate = formatDateToISO(formatted);
        if (onChange) {
          onChange({ target: { value: isoDate } });
        }
      }
    }
  };

  // Handle calendar button click
  const handleCalendarClick = () => {
    if (readOnly) return;
    if (hiddenDateInputRef.current) {
      hiddenDateInputRef.current.showPicker();
    }
  };

  // Handle date selection from native picker
  const handleDatePickerChange = (e) => {
    const isoDate = e.target.value;
    if (isoDate) {
      setDisplayValue(formatDateToGerman(isoDate));
      if (onChange) {
        onChange({ target: { value: isoDate } });
      }
    }
  };

  // Get the ISO value for the hidden date input
  const getISOValue = () => {
    if (!value) return '';
    // Skip marker should not be converted
    if (isSkipMarker(value)) return '';
    // If already ISO format (contains dashes), return as-is
    if (value.includes('-')) return value;
    // Convert from German to ISO
    return formatDateToISO(value);
  };

  return (
    <div className={`w-full overflow-hidden ${className}`}>
      {label && (
        <label className="block mb-1 font-bold text-sm text-white">
          {label}
        </label>
      )}
      <div className="flex gap-1 items-center mb-2.5 w-full">
        {/* Text input for dd.mm.yyyy format */}
        <input
          type="text"
          value={displayValue}
          onChange={handleTextChange}
          onBlur={handleBlur}
          readOnly={readOnly}
          placeholder="dd.mm.yyyy"
          style={{
            flex: '1 1 0',
            minWidth: 0,
            padding: '8px 12px',
            backgroundColor: readOnly ? '#374151' : 'white',
            border: error ? '2px solid #ef4444' : '1px solid #d1d5db',
            borderRadius: '6px',
            color: readOnly ? 'white' : 'black',
            fontSize: '14px',
            height: '34px',
            boxSizing: 'border-box',
            cursor: readOnly ? 'not-allowed' : 'text',
            outline: 'none'
          }}
          {...props}
        />
        
        {/* Hidden native date input for calendar picker */}
        <input
          ref={hiddenDateInputRef}
          type="date"
          value={getISOValue()}
          onChange={handleDatePickerChange}
          style={{
            position: 'absolute',
            opacity: 0,
            width: 0,
            height: 0,
            pointerEvents: 'none'
          }}
          tabIndex={-1}
        />
        
        {/* Calendar button */}
        {!readOnly && (
          <button
            type="button"
            onClick={handleCalendarClick}
            style={{
              flexShrink: 0,
              padding: '6px 10px',
              backgroundColor: '#4b5563',
              border: '1px solid #6b7280',
              borderRadius: '6px',
              color: 'white',
              fontSize: '14px',
              height: '34px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            title="Open calendar"
          >
            📅
          </button>
        )}
        
        {showClearButton && displayValue && (
          <Button
            onClick={handleClear}
            variant="danger"
            size="small"
            className="h-[34px] min-w-[34px] px-2 flex-shrink-0"
            title="Clear date"
          >
            ✕
          </Button>
        )}
      </div>
      {error && (
        <div className="text-red-500 text-xs mt-1 mb-2">
          {error}
        </div>
      )}
      {helperText && !error && (
        <div className="text-gray-400 text-xs mt-1 mb-2">
          {helperText}
        </div>
      )}
    </div>
  );
};

export default DateInput;
