import React, { useState } from 'react';
import TermsAndConditions, { TermsContent, TERMS_VERSION, TERMS_LAST_UPDATED } from './TermsAndConditions';
import { api } from './api';
import Button from './components/Button';
import TextInput from './components/TextInput';

/**
 * Dialog shown after login when user hasn't accepted the latest terms.
 * Requires admin password to accept new terms.
 */
export default function TermsAcceptanceDialog({ 
  isOpen, 
  onClose, 
  onAccepted, 
  currentVersion, 
  userAcceptedVersion 
}) {
  const [adminPassword, setAdminPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showFullTerms, setShowFullTerms] = useState(false);

  if (!isOpen) return null;

  const handleAccept = async (e) => {
    e.preventDefault();
    
    if (!adminPassword) {
      setError('Bitte geben Sie das Admin-Passwort ein');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      await api.acceptTerms(adminPassword, currentVersion);
      onAccepted();
    } catch (err) {
      setError(err.message || 'Fehler beim Akzeptieren der Nutzungsbedingungen');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setAdminPassword('');
    setError('');
    onClose();
  };

  return (
    <>
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        zIndex: 2000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}>
        <div style={{
          backgroundColor: 'var(--login-panel-bg, #1a1a2e)',
          borderRadius: '12px',
          maxWidth: '600px',
          width: '100%',
          maxHeight: '90vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          color: 'var(--login-text-primary, #fff)'
        }}>
          {/* Header */}
          <div style={{
            padding: '20px 24px',
            borderBottom: '1px solid var(--login-border, #333)',
            flexShrink: 0
          }}>
            <h2 style={{ margin: 0, fontSize: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '24px' }}>📋</span>
              Neue Nutzungsbedingungen
            </h2>
          </div>

          {/* Content */}
          <div style={{
            padding: '24px',
            overflowY: 'auto',
            flex: 1
          }}>
            {/* Warning Box */}
            <div style={{
              backgroundColor: 'rgba(255, 193, 7, 0.1)',
              border: '1px solid #FFC107',
              borderRadius: '8px',
              padding: '16px',
              marginBottom: '20px'
            }}>
              <h3 style={{ 
                margin: '0 0 8px 0', 
                fontSize: '16px', 
                color: '#FFC107',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <span>⚠️</span>
                Aktualisierung erforderlich
              </h3>
              <p style={{ margin: 0, fontSize: '14px', lineHeight: '1.5' }}>
                Es gibt aktualisierte Nutzungsbedingungen und Datenschutzbestimmungen 
                (Version <strong>{currentVersion}</strong>), die Sie akzeptieren müssen, 
                um den Dienst weiterhin nutzen zu können.
              </p>
              {userAcceptedVersion && (
                <p style={{ margin: '8px 0 0 0', fontSize: '13px', color: 'var(--login-text-secondary, #888)' }}>
                  Ihre aktuell akzeptierte Version: {userAcceptedVersion}
                </p>
              )}
            </div>

            {/* Info Box */}
            <div style={{
              backgroundColor: 'rgba(33, 150, 243, 0.1)',
              border: '1px solid #2196F3',
              borderRadius: '8px',
              padding: '16px',
              marginBottom: '20px'
            }}>
              <p style={{ margin: 0, fontSize: '14px', lineHeight: '1.5' }}>
                <strong>Hinweis:</strong> Als Kontoinhaber sind Sie dafür verantwortlich, 
                alle Personen, die Zugang zu Ihrem Familienkonto haben, über die aktualisierten 
                Bedingungen zu informieren.
              </p>
            </div>

            {/* Terms Preview */}
            <div style={{
              marginBottom: '20px'
            }}>
              <button
                type="button"
                onClick={() => setShowFullTerms(true)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#4CAF50',
                  textDecoration: 'underline',
                  cursor: 'pointer',
                  padding: 0,
                  fontSize: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <span>📄</span>
                Vollständige Nutzungsbedingungen und Datenschutzerklärung lesen
              </button>
              <p style={{ 
                margin: '8px 0 0 0', 
                fontSize: '12px', 
                color: 'var(--login-text-muted, #666)' 
              }}>
                Version {TERMS_VERSION} | Stand: {TERMS_LAST_UPDATED}
              </p>
            </div>

            {/* Accept Form */}
            <form onSubmit={handleAccept}>
              <div style={{ marginBottom: '16px' }}>
                <TextInput
                  label="Admin-Passwort zur Bestätigung"
                  type="password"
                  value={adminPassword}
                  onChange={(e) => {
                    setAdminPassword(e.target.value);
                    setError('');
                  }}
                  placeholder="Admin-Passwort eingeben"
                  error={error}
                  helperText={!error ? "Das Admin-Passwort wird benötigt, um die neuen Bedingungen im Namen aller Familienmitglieder zu akzeptieren." : ""}
                />
              </div>

              {/* Deadline Warning */}
              <div style={{
                backgroundColor: 'rgba(255, 87, 34, 0.1)',
                border: '1px solid #FF5722',
                borderRadius: '8px',
                padding: '12px',
                marginBottom: '20px',
                fontSize: '13px'
              }}>
                <strong>⏰ Wichtig:</strong> Wenn Sie die neuen Bedingungen nicht innerhalb 
                eines Monats nach deren Veröffentlichung akzeptieren, wird Ihr Konto und 
                alle zugehörigen Daten gelöscht.
              </div>
            </form>
          </div>

          {/* Footer */}
          <div style={{
            padding: '16px 24px',
            borderTop: '1px solid var(--login-border, #333)',
            display: 'flex',
            justifyContent: 'space-between',
            gap: '12px',
            flexShrink: 0
          }}>
            <Button
              type="button"
              onClick={handleClose}
              variant="secondary"
              size="medium"
            >
              Später
            </Button>
            <Button
              type="button"
              onClick={handleAccept}
              variant="success"
              size="medium"
              disabled={loading || !adminPassword}
            >
              {loading ? 'Wird akzeptiert...' : 'Nutzungsbedingungen akzeptieren'}
            </Button>
          </div>
        </div>
      </div>

      {/* Full Terms Modal */}
      <TermsAndConditions isOpen={showFullTerms} onClose={() => setShowFullTerms(false)} />
    </>
  );
}
