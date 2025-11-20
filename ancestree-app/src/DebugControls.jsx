import React from 'react';

const DebugControls = ({ showDebug, setShowDebug }) => {
  return (
    <button 
      onClick={() => setShowDebug(!showDebug)}
      style={{
        width: '100%',
        padding: '12px',
        backgroundColor: showDebug ? 'var(--button-debug-on)' : 'var(--button-debug-off)',
        color: 'white',
        border: 'none',
        borderRadius: '5px',
        fontSize: '16px',
        cursor: 'pointer',
        marginBottom: '10px'
      }}
      onMouseOver={(e) => e.target.style.backgroundColor = showDebug ? 'var(--button-debug-on-hover)' : 'var(--button-debug-off-hover)'}
      onMouseOut={(e) => e.target.style.backgroundColor = showDebug ? 'var(--button-debug-on)' : 'var(--button-debug-off)'}
    >
      {showDebug ? '🚫 Hide Debug' : '🔧 Show Debug'}
    </button>
  );
};

export default DebugControls;
