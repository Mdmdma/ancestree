import React from 'react';

/**
 * Reusable Switch/Toggle component with Tailwind CSS
 * @param {boolean} checked - Current state of the switch
 * @param {function} onChange - Callback when switch is toggled
 * @param {boolean} disabled - Whether the switch is disabled
 * @param {string} label - Optional label text
 * @param {string} helperText - Optional helper text below label
 * @param {string} size - Size variant: 'small', 'medium', 'large' (default: 'medium')
 */
const Switch = ({ 
  checked, 
  onChange, 
  disabled = false, 
  label = null, 
  helperText = null,
  size = 'medium' 
}) => {
  const sizeStyles = {
    small: {
      track: 'w-11 h-6',
      thumb: 'w-5 h-5',
      thumbOffset: checked ? 'translate-x-5' : 'translate-x-0.5'
    },
    medium: {
      track: 'w-14 h-7',
      thumb: 'w-6 h-6',
      thumbOffset: checked ? 'translate-x-7' : 'translate-x-0.5'
    },
    large: {
      track: 'w-16 h-8',
      thumb: 'w-7 h-7',
      thumbOffset: checked ? 'translate-x-8' : 'translate-x-0.5'
    }
  };

  const currentSize = sizeStyles[size] || sizeStyles.medium;

  const handleClick = () => {
    if (!disabled && onChange) {
      onChange(!checked);
    }
  };

  const handleKeyDown = (e) => {
    if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      onChange(!checked);
    }
  };

  const switchElement = (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      disabled={disabled}
      className={`
        relative inline-flex items-center rounded-full transition-colors duration-200 ease-in-out
        focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500
        ${currentSize.track}
        ${checked ? 'bg-green-600' : 'bg-gray-400'}
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
      `}
    >
      <span
        className={`
          inline-block rounded-full bg-white shadow-lg transform transition-transform duration-200 ease-in-out
          ${currentSize.thumb}
          ${currentSize.thumbOffset}
        `}
      />
    </button>
  );

  if (!label) {
    return switchElement;
  }

  return (
    <div className="flex items-center gap-3">
      {switchElement}
      <div className="flex-1">
        <label 
          onClick={handleClick}
          className={`text-white font-medium text-sm ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
        >
          {label}
        </label>
        {helperText && (
          <div className="text-xs text-gray-400 mt-1">
            {helperText}
          </div>
        )}
      </div>
    </div>
  );
};

export default Switch;
