import React from 'react';
import { useTranslation } from './locales/LanguageContext';
import Button from './components/Button';

const AppHeader = ({ user, onLogout, onAdminClick }) => {
  const { t } = useTranslation();
  
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
        <div className="absolute top-[10px] right-[30px] z-[1000]">
          <Button
            onClick={onLogout}
            variant="secondary"
            size="medium"
            icon="🚪"
            className="bg-[var(--header-bg)] text-[var(--header-text)] hover:bg-[var(--header-bg)] hover:opacity-90"
          >
            {t.header.logoutButton}
          </Button>
        </div>
      )}

      {/* User Info - Clickable for Admin Panel */}
      {user && (
        <div className="absolute top-[10px] left-[10px] z-[1000]">
          <Button
            onClick={onAdminClick}
            variant="secondary"
            size="medium"
            className="bg-[var(--header-user-bg)] text-[var(--header-user-text)] hover:bg-white shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all"
          >
            <span>👨‍👩‍👧‍👦</span>
            <span>{user.displayName || (user.familyName + ' Family')}</span>
            <span className="text-[10px] opacity-70">⚙️</span>
          </Button>
        </div>
      )}

      <h1 className="mobile-hide-title" style={{ 
        margin: '0 0 5px 0', 
        fontSize: '2rem',
        lineHeight: '1.2'
      }}>
        {user?.displayName ? `${t.header.familyPrefix} ${user.displayName}` : t.header.title}
      </h1>
      <p className="mobile-hide-subtitle" style={{ 
        margin: '0 0 3px 0', 
        fontSize: '0.9rem',
        lineHeight: '1.2'
      }}>
        {t.header.subtitle}
      </p>
      <p className="mobile-hide-description" style={{ 
        margin: '0', 
        fontSize: '0.8rem',
        lineHeight: '1.2',
        opacity: 0.8
      }}>
        {t.header.description}
      </p>
    </article>
  );
};

export default AppHeader;
