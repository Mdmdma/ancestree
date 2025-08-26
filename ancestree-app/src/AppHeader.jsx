import React from 'react';
import { appConfig } from './config';

const AppHeader = ({ user, onLogout }) => {
  return (
    <article className="container" style={{ 
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
            gap: '5px'
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
          fontSize: '12px',
          color: '#666',
          display: 'flex',
          alignItems: 'center',
          gap: '5px'
        }}>
          <span>👨‍👩‍👧‍👦</span>
          <span>{user.familyName} Family</span>
        </div>
      )}

      <h1 style={{ 
        margin: '0 0 5px 0', 
        fontSize: '2rem',
        lineHeight: '1.2'
      }}>
        {appConfig.header.title}
      </h1>
      <p style={{ 
        margin: '0 0 3px 0', 
        fontSize: '0.9rem',
        lineHeight: '1.2'
      }}>
        {appConfig.header.subtitle}
      </p>
      <p style={{ 
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
