import React from 'react';

const DebugControls = ({ showDebug, setShowDebug }) => {
  return (
    <button 
      onClick={() => setShowDebug(!showDebug)}
      style={{
        width: '100%',
        padding: '12px',
        backgroundColor: showDebug ? '#FF5722' : '#9C27B0',
        color: 'white',
        border: 'none',
        borderRadius: '5px',
        fontSize: '16px',
        cursor: 'pointer',
        marginBottom: '10px'
      }}
      onMouseOver={(e) => e.target.style.backgroundColor = showDebug ? '#E64A19' : '#7B1FA2'}
      onMouseOut={(e) => e.target.style.backgroundColor = showDebug ? '#FF5722' : '#9C27B0'}
    >
      {showDebug ? '🚫 Hide Debug' : '🔧 Show Debug'}
    </button>
  );
};

export default DebugControls;
