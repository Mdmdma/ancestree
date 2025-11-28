import React, { useRef, useEffect } from 'react';
import Button from './Button';

/**
 * Unified textarea component for image descriptions
 * Features:
 * - Character counter below the textarea (always visible, never covered)
 * - Elastic height: minimum 4 rows, auto-grows with content
 * - Scrolling only when exceeding 8 lines (reduced for compact display)
 * - Keyboard shortcuts (Cmd/Ctrl+Enter to save, Escape to cancel)
 * - Consistent styling across all uses
 * - Tailwind CSS utility classes with fallback inline styles
 * - Rounded corners (8px) matching slideshow design
 */
const DescriptionTextarea = ({ 
  value, 
  onChange, 
  onSave, 
  onCancel,
  placeholder = "Enter image description...",
  maxLength = 3000,
  minHeight = '120px', // Kept for backward compatibility but not used
  readOnly = false,
  showButtons = true,
  saveButtonText = "Save",
  cancelButtonText = "Cancel",
  className = ""
}) => {
  const textareaRef = useRef(null);
  const characterCount = value?.length || 0;
  const isNearLimit = characterCount > maxLength - 100;

  // Auto-resize textarea based on content
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    // Reset height to get accurate scrollHeight
    textarea.style.height = 'auto';
    
    // Calculate line height (approximate)
    const computedStyle = window.getComputedStyle(textarea);
    const lineHeight = parseInt(computedStyle.lineHeight) || 20;
    
    // Calculate heights
    const minRows = 4;
    const maxRows = 8; // Reduced from 20 for more compact display
    const minHeightPx = lineHeight * minRows + 24; // 24px for padding
    const maxHeightPx = lineHeight * maxRows + 24;
    
    // Set new height based on content
    const newHeight = Math.min(Math.max(textarea.scrollHeight, minHeightPx), maxHeightPx);
    textarea.style.height = `${newHeight}px`;
    
    // Enable scrolling only if content exceeds max height
    textarea.style.overflowY = textarea.scrollHeight > maxHeightPx ? 'auto' : 'hidden';
  }, [value]);

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
      <div className="w-full">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={onChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          maxLength={maxLength}
          readOnly={readOnly}
          className="w-full resize-none font-inherit text-sm bg-zinc-800 text-white border border-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
          style={{
            paddingLeft: '12px',
            paddingRight: '12px',
            paddingTop: '12px',
            paddingBottom: '12px',
            borderRadius: '8px',
            boxSizing: 'border-box',
            lineHeight: '1.5'
          }}
        />
        {/* Character counter below textarea, always visible */}
        <div 
          className={`text-xs text-right mt-1 transition-colors ${
            isNearLimit ? 'text-red-500 font-semibold' : 'text-gray-400'
          }`}
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
            >
              {cancelButtonText}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DescriptionTextarea;
