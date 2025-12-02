import React, { useState } from 'react';
import { useTranslation } from './locales/LanguageContext';
import Button from './components/Button';

const ContactButton = () => {
  const { t } = useTranslation();
  const [showDialog, setShowDialog] = useState(false);

  return (
    <>
      {/* Contact Button - Hidden on mobile */}
      <div 
        className="contact-button-container"
        style={{
          position: 'fixed',
          bottom: '20px',
          left: '20px',
          zIndex: 9999
        }}
      >
        <Button
          onClick={() => setShowDialog(true)}
          variant="primary"
          size="medium"
          className="bg-[#3498db] hover:bg-[#2980b9] shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all"
        >
          {t.ui.contact.buttonText}
        </Button>
      </div>

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
              backgroundColor: '#ffffff',
              borderRadius: '16px',
              padding: '40px 32px 32px 32px',
              maxWidth: '520px',
              width: '90%',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div 
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '24px',
                paddingBottom: '20px',
                borderBottom: '2px solid #e5e7eb'
              }}
            >
              <h2 
                style={{
                  margin: 0,
                  fontSize: '24px',
                  fontWeight: '600',
                  color: '#1f2937'
                }}
              >
                {t.ui.contact.dialogTitle}
              </h2>
              <button
                onClick={() => setShowDialog(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#9ca3af',
                  fontSize: '32px',
                  cursor: 'pointer',
                  padding: '4px',
                  lineHeight: '1',
                  transition: 'all 0.2s ease',
                  width: '36px',
                  height: '36px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '6px'
                }}
                onMouseEnter={(e) => {
                  e.target.style.color = '#1f2937';
                  e.target.style.backgroundColor = '#f3f4f6';
                }}
                onMouseLeave={(e) => {
                  e.target.style.color = '#9ca3af';
                  e.target.style.backgroundColor = 'transparent';
                }}
              >
                ×
              </button>
            </div>

            {/* Description */}
            <div 
              style={{
                backgroundColor: '#f9fafb',
                padding: '24px',
                borderRadius: '12px',
                marginBottom: '24px'
              }}
            >
              <p 
                style={{
                  margin: 0,
                  fontSize: '16px',
                  lineHeight: '1.625',
                  color: '#374151'
                }}
              >
                {t.ui.contact.description}
              </p>
            </div>

            {/* Contact Buttons - Split */}
            <div 
              style={{
                display: 'flex',
                gap: '16px'
              }}
            >
              {/* Email Button */}
              <div style={{ flex: 1 }}>
                <a
                  href={`mailto:${t.ui.contact.emailAddress}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'block',
                    textDecoration: 'none'
                  }}
                >
                  <Button
                    variant="primary"
                    size="medium"
                    className="bg-[#3498db] hover:bg-[#2980b9] shadow-md hover:shadow-lg w-full"
                  >
                    {t.ui.contact.emailButtonText}
                  </Button>
                </a>
              </div>

              {/* GitHub Button */}
              <div style={{ flex: 1 }}>
                <a
                  href={t.ui.contact.githubUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'block',
                    textDecoration: 'none'
                  }}
                >
                  <Button
                    variant="secondary"
                    size="medium"
                    className="bg-[#2c3e50] hover:bg-[#1a252f] shadow-md hover:shadow-lg w-full"
                  >
                    {t.ui.contact.githubButtonText}
                  </Button>
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CSS to hide on mobile */}
      <style>
        {`
          @media (max-width: 768px) {
            .contact-button-container {
              display: none !important;
            }
          }
        `}
      </style>
    </>
  );
};

export default ContactButton;
