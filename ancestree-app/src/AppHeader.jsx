import React from 'react';
import { appConfig } from './config';

const AppHeader = ({ user, onLogout, onAdminClick }) => {
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
            backgroundColor: 'var(--header-bg)',
            color: 'var(--header-text)',
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
          {appConfig.header.logoutButton}
        </button>
      )}

      {/* User Info - Clickable for Admin Panel */}
      {user && (
        <button
          onClick={onAdminClick}
          style={{
            position: 'absolute',
            top: '10px',
            left: '10px',
            fontSize: '14px',
            color: 'var(--header-user-text)',
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            backgroundColor: 'var(--header-user-bg)',
            padding: '6px 12px',
            borderRadius: '6px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            zIndex: 1000,
            border: 'none',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            e.target.style.backgroundColor = 'rgba(255, 255, 255, 1)';
            e.target.style.boxShadow = '0 4px 8px rgba(0,0,0,0.15)';
            e.target.style.transform = 'translateY(-1px)';
          }}
          onMouseLeave={(e) => {
            e.target.style.backgroundColor = 'var(--header-user-bg)';
            e.target.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
            e.target.style.transform = 'translateY(0)';
          }}
        >
          <span>👨‍👩‍👧‍👦</span>
          <span>{user.displayName || (user.familyName + ' Family')}</span>
          <span style={{ fontSize: '10px', opacity: 0.7 }}>⚙️</span>
        </button>
      )}

      <h1 className="mobile-hide-title" style={{ 
        margin: '0 0 5px 0', 
        fontSize: '2rem',
        lineHeight: '1.2'
      }}>
        {user?.displayName ? `${appConfig.header.familyPrefix} ${user.displayName}` : appConfig.header.title}
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
