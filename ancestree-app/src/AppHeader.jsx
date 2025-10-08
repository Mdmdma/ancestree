import React from 'react';
import { appConfig } from './config';

const AppHeader = ({ user, onLogout }) => {
  return (
    <article className="container app-header" style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      padding: '5px 10px',
      margin: 0,
      position: 'relative'
    }}>
      {/* Logout Button */}
      {user && onLogout && (
        <button
          onClick={onLogout}
          style={{
            position: 'absolute',
            top: '10px',
            right: '10px',
            backgroundColor: '#e74c3c',
            color: 'white',
            border: 'none',
            padding: '6px 12px',
            borderRadius: '4px',
            fontSize: '12px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            zIndex: 1000
          }}
        >
          <span>🚪</span>
          Logout
        </button>
      )}

      {/* User Info */}
      {user && (
        <div style={{
          position: 'absolute',
          top: '10px',
          left: '10px',
          fontSize: '14px',
          color: '#333',
          fontWeight: '600',
          display: 'flex',
          alignItems: 'center',
          gap: '5px',
          backgroundColor: 'rgba(255, 255, 255, 0.9)',
          padding: '6px 12px',
          borderRadius: '6px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          zIndex: 1000
        }}>
          <span>👨‍👩‍👧‍👦</span>
          <span>{user.familyName} Family</span>
        </div>
      )}

      <h1 className="mobile-hide-title" style={{ 
        margin: '0 0 5px 0', 
        fontSize: '2rem',
        lineHeight: '1.2'
      }}>
        {appConfig.header.title}
      </h1>
      <p className="mobile-hide-subtitle" style={{ 
        margin: '0 0 3px 0', 
        fontSize: '0.9rem',
        lineHeight: '1.2'
      }}>
        {appConfig.header.subtitle}
      </p>
      <p className="mobile-hide-description" style={{ 
        margin: '0', 
        fontSize: '0.8rem',
        lineHeight: '1.2',
        opacity: 0.8
      }}>
        {appConfig.header.description}
      </p>
    </article>
  );
};

export default AppHeader;
