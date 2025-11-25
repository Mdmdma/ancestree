import React from 'react';
import Button from './Button';

/**
 * Unified textarea component for image descriptions
 * Features:
 * - Character counter inside the textarea (bottom-right)
 * - Keyboard shortcuts (Cmd/Ctrl+Enter to save, Escape to cancel)
 * - Consistent styling across all uses
 * - Tailwind CSS utility classes with fallback inline styles
 * - Rounded corners (8px) matching slideshow design
 * - Centers content and uses available space
 */
const DescriptionTextarea = ({ 
  value, 
  onChange, 
  onSave, 
  onCancel,
  placeholder = "Enter image description...",
  maxLength = 1000,
  minHeight = '120px',
  readOnly = false,
  showButtons = true,
  saveButtonText = "Save",
  cancelButtonText = "Cancel",
  className = ""
}) => {
  const characterCount = value?.length || 0;
  const isNearLimit = characterCount > 950;

  const handleKeyDown = (e) => {
    // Save on Cmd/Ctrl + Enter
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && onSave) {
      e.preventDefault();
      onSave();
    }
    // Cancel on Escape
    if (e.key === 'Escape' && onCancel) {
      e.preventDefault();
      onCancel();
    }
  };

  return (
    <div className={`w-full ${className}`}>
      <div className="relative w-full">
        <textarea
          value={value}
          onChange={onChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          maxLength={maxLength}
          readOnly={readOnly}
          className="w-full resize-y font-inherit text-sm bg-zinc-800 text-white border border-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
          style={{
            minHeight: minHeight,
            padding: '12px',
            paddingBottom: '32px', // Extra space for character counter inside
            borderRadius: '8px', // Rounder corners matching slideshow
            boxSizing: 'border-box'
          }}
        />
        {/* Character counter inside textarea at bottom-right */}
        <div 
          className={`absolute text-xs pointer-events-none select-none transition-colors ${
            isNearLimit ? 'text-red-500 font-semibold' : 'text-gray-400'
          }`}
          style={{
            bottom: '8px',
            right: '12px'
          }}
        >
          {characterCount}/{maxLength}
        </div>
      </div>
      
      {showButtons && (
        <div className="mt-4 w-full" style={{ display: 'flex', gap: '12px' }}>
          <div style={{ flex: 1 }}>
            <Button
              onClick={onSave}
              disabled={!onSave}
              variant="success"
              size="medium"
              icon="✓"
            >
              {saveButtonText}
            </Button>
          </div>

          <div style={{ flex: 1 }}>
            <Button
              onClick={onCancel}
              disabled={!onCancel}
              variant="danger"
              size="medium"
              icon="✕"
            >
              {cancelButtonText}
            </Button>
          </div>
        </div>
      )}
      
      {showButtons && (
        <div className="mt-2 text-xs text-gray-400 italic text-center">
          💡 Tip: Press Cmd/Ctrl+Enter to save, Escape to cancel
        </div>
      )}
    </div>
  );
};

export default DescriptionTextarea;
