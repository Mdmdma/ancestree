import React from 'react';

/**
 * Reusable TextInput component with consistent styling
 * Features:
 * - Label support
 * - Placeholder text
 * - Error state styling
 * - Optional helper text
 * - Read-only mode
 * - Tailwind CSS based
 */
const TextInput = ({
  label,
  value,
  onChange,
  placeholder = '',
  error = '',
  helperText = '',
  type = 'text',
  readOnly = false,
  maxLength,
  className = '',
  inputRef,
  ...props
}) => {
  return (
    <div>
      {label && (
        <label className="block mb-1 font-bold text-sm text-white">
          {label}
        </label>
      )}
      <input
        ref={inputRef}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        readOnly={readOnly}
        maxLength={maxLength}
        style={{
          width: '100%',
          padding: '8px 12px',
          marginBottom: '10px',
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

export default TextInput;
