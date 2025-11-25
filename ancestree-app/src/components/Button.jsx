import React from 'react';

/**
 * Reusable Button component with consistent styling across the application
 * Features:
 * - Multiple variants (primary, secondary, danger, success)
 * - Proper padding and sizing
 * - Hover and active states
 * - Disabled state
 * - Optional icon support
 */
const Button = ({ 
  children,
  onClick,
  disabled = false,
  variant = 'primary', // 'primary', 'secondary', 'danger', 'success'
  size = 'medium', // 'small', 'medium', 'large'
  icon,
  className = '',
  ...props
}) => {
  // Base styles
  const baseStyles = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    border: 'none',
    borderRadius: '6px',
    fontWeight: '500',
    cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'all 0.2s ease',
    fontFamily: 'inherit',
    lineHeight: '1',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  };

  // Size variants
  const sizeStyles = {
    small: {
      padding: '6px 12px',
      fontSize: '12px',
      minHeight: '28px'
    },
    medium: {
      padding: '10px 20px',
      fontSize: '14px',
      minHeight: '36px'
    },
    large: {
      padding: '12px 24px',
      fontSize: '16px',
      minHeight: '44px'
    }
  };

  // Color variants
  const variantStyles = {
    primary: {
      backgroundColor: disabled ? '#6b7280' : '#2196F3',
      color: '#ffffff',
      hoverBg: '#1976D2',
      activeBg: '#1565C0'
    },
    secondary: {
      backgroundColor: disabled ? '#6b7280' : '#64748b',
      color: '#ffffff',
      hoverBg: '#475569',
      activeBg: '#334155'
    },
    success: {
      backgroundColor: disabled ? '#6b7280' : '#10b981',
      color: '#ffffff',
      hoverBg: '#059669',
      activeBg: '#047857'
    },
    danger: {
      backgroundColor: disabled ? '#6b7280' : '#ef4444',
      color: '#ffffff',
      hoverBg: '#dc2626',
      activeBg: '#b91c1c'
    }
  };

  const currentVariant = variantStyles[variant];
  const currentSize = sizeStyles[size];

  const [isHovered, setIsHovered] = React.useState(false);
  const [isActive, setIsActive] = React.useState(false);

  const getBackgroundColor = () => {
    if (disabled) return currentVariant.backgroundColor;
    if (isActive) return currentVariant.activeBg;
    if (isHovered) return currentVariant.hoverBg;
    return currentVariant.backgroundColor;
  };

  const buttonStyle = {
    ...baseStyles,
    ...currentSize,
    backgroundColor: getBackgroundColor(),
    color: currentVariant.color,
    opacity: disabled ? 0.6 : 1,
    transform: isActive && !disabled ? 'scale(0.98)' : 'scale(1)',
    boxShadow: isHovered && !disabled ? '0 2px 8px rgba(0, 0, 0, 0.15)' : '0 1px 3px rgba(0, 0, 0, 0.1)',
    width: '100%' // Ensure button fills its container
  };

  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      onMouseEnter={() => !disabled && setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setIsActive(false);
      }}
      onMouseDown={() => !disabled && setIsActive(true)}
      onMouseUp={() => setIsActive(false)}
      style={buttonStyle}
      className={className}
      {...props}
    >
      {icon && <span style={{ fontSize: '16px', lineHeight: '1' }}>{icon}</span>}
      <span style={{ lineHeight: '1' }}>{children}</span>
    </button>
  );
};

export default Button;
