import React from 'react';
import Button from './Button';

/**
 * Reusable DateInput component with consistent styling
 * Features:
 * - Label support
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
  const handleClear = () => {
    if (onClear) {
      onClear();
    }
  };

  return (
    <div>
      {label && (
        <label className="block mb-1 font-bold text-sm text-white">
          {label}
        </label>
      )}
      <div className="flex gap-1 items-center mb-2.5">
        <input
          type="date"
          value={value}
          onChange={onChange}
          readOnly={readOnly}
          style={{
            flex: 1,
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
        {showClearButton && value && (
          <Button
            onClick={handleClear}
            variant="danger"
            size="small"
            className="h-[34px] min-w-[34px] px-2"
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
