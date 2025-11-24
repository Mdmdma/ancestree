import React, { useState } from 'react';
import { appConfig } from './config';

const ContactButton = () => {
  const [showDialog, setShowDialog] = useState(false);

  return (
    <>
      {/* Contact Button - Hidden on mobile */}
      <button
        onClick={() => setShowDialog(true)}
        className="contact-button"
        style={{
          position: 'fixed',
          bottom: '20px',
          left: '20px',
          backgroundColor: '#3498db',
          color: 'white',
          border: 'none',
          padding: '12px 20px',
          borderRadius: '8px',
          fontSize: '14px',
          fontWeight: '600',
          cursor: 'pointer',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          zIndex: 9999,
          transition: 'all 0.2s ease',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}
        onMouseEnter={(e) => {
          e.target.style.backgroundColor = '#2980b9';
          e.target.style.transform = 'translateY(-2px)';
          e.target.style.boxShadow = '0 6px 16px rgba(0,0,0,0.2)';
        }}
        onMouseLeave={(e) => {
          e.target.style.backgroundColor = '#3498db';
          e.target.style.transform = 'translateY(0)';
          e.target.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
        }}
      >
        {appConfig.ui.contact.buttonText}
      </button>

      {/* Contact Dialog */}
      {showDialog && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            backdropFilter: 'blur(4px)'
          }}
          onClick={() => setShowDialog(false)}
        >
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              padding: '30px',
              maxWidth: '500px',
              width: '90%',
              boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
              color: '#2c3e50'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '20px',
              borderBottom: '2px solid #ecf0f1',
              paddingBottom: '15px'
            }}>
              <h2 style={{ margin: 0, fontSize: '24px', color: '#2c3e50' }}>
                {appConfig.ui.contact.dialogTitle}
              </h2>
              <button
                onClick={() => setShowDialog(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#7f8c8d',
                  fontSize: '28px',
                  cursor: 'pointer',
                  padding: '0',
                  lineHeight: '1',
                  transition: 'color 0.2s'
                }}
                onMouseEnter={(e) => e.target.style.color = '#2c3e50'}
                onMouseLeave={(e) => e.target.style.color = '#7f8c8d'}
              >
                ×
              </button>
            </div>

            {/* Description */}
            <div style={{
              backgroundColor: '#ecf0f1',
              padding: '20px',
              borderRadius: '8px',
              marginBottom: '20px'
            }}>
              <p style={{ 
                margin: 0, 
                fontSize: '15px', 
                lineHeight: '1.6',
                color: '#34495e'
              }}>
                {appConfig.ui.contact.description}
              </p>
            </div>

            {/* Contact Buttons - Split */}
            <div style={{
              display: 'flex',
              gap: '12px',
              marginBottom: '12px'
            }}>
              {/* Email Button */}
              <a
                href={`mailto:${appConfig.ui.contact.emailAddress}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'block',
                  flex: 1,
                  textAlign: 'center',
                  padding: '15px 10px',
                  backgroundColor: '#3498db',
                  color: 'white',
                  textDecoration: 'none',
                  borderRadius: '8px',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  transition: 'background-color 0.2s',
                  boxShadow: '0 2px 8px rgba(52, 152, 219, 0.3)',
                  boxSizing: 'border-box'
                }}
                onMouseEnter={(e) => e.target.style.backgroundColor = '#2980b9'}
                onMouseLeave={(e) => e.target.style.backgroundColor = '#3498db'}
              >
                {appConfig.ui.contact.emailButtonText}
              </a>

              {/* GitHub Button */}
              <a
                href={appConfig.ui.contact.githubUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'block',
                  flex: 1,
                  textAlign: 'center',
                  padding: '15px 10px',
                  backgroundColor: '#2c3e50',
                  color: 'white',
                  textDecoration: 'none',
                  borderRadius: '8px',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  transition: 'background-color 0.2s',
                  boxShadow: '0 2px 8px rgba(44, 62, 80, 0.3)',
                  boxSizing: 'border-box'
                }}
                onMouseEnter={(e) => e.target.style.backgroundColor = '#1a252f'}
                onMouseLeave={(e) => e.target.style.backgroundColor = '#2c3e50'}
              >
                {appConfig.ui.contact.githubButtonText}
              </a>
            </div>

            {/* Close Button */}
            <button
              onClick={() => setShowDialog(false)}
              style={{
                width: '100%',
                padding: '12px',
                backgroundColor: '#95a5a6',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                cursor: 'pointer',
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={(e) => e.target.style.backgroundColor = '#7f8c8d'}
              onMouseLeave={(e) => e.target.style.backgroundColor = '#95a5a6'}
            >
              {appConfig.ui.contact.closeButton}
            </button>
          </div>
        </div>
      )}

      {/* CSS to hide on mobile */}
      <style>
        {`
          @media (max-width: 768px) {
            .contact-button {
              display: none !important;
            }
          }
        `}
      </style>
    </>
  );
};

export default ContactButton;
