import React, { useState, useEffect } from 'react';
import { api, getLastFamilyName } from './api.js';
import { initializeSession } from './encryptionSession';
import { appConfig } from './config.js';
import TextInput from './components/TextInput';
import Button from './components/Button';
import ContactButton from './ContactButton';

export default function Login({ onLoginSuccess }) {
  const [familyName, setFamilyName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [betaAccessPassword, setBetaAccessPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [authStatus, setAuthStatus] = useState(null);
  const [emailError, setEmailError] = useState('');

  // Check if family is already registered
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const status = await api.checkAuthStatus();
        setAuthStatus(status);
        setIsRegistering(status.requiresSetup);
        
        // Pre-fill family name from last login if not registering
        if (!status.requiresSetup) {
          const lastFamily = getLastFamilyName();
          if (lastFamily) {
            setFamilyName(lastFamily);
          }
        }
      } catch (error) {
        console.error('Failed to check auth status:', error);
      }
    };
    checkStatus();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setEmailError('');

    // Validate email format if registering
    if (isRegistering && adminEmail) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(adminEmail)) {
        setEmailError('Please enter a valid email address');
        setLoading(false);
        return;
      }
    }

    // Require email for registration
    if (isRegistering && !adminEmail) {
      setEmailError('Admin email is required');
      setLoading(false);
      return;
    }

    try {
      let result;
      if (isRegistering) {
        result = await api.register(familyName, password, displayName, adminPassword, adminEmail, betaAccessPassword);
      } else {
        result = await api.login(familyName, password);
      }

      console.log('Authentication successful:', result);
      
      // Initialize encryption session
      try {
        let familySettings;
        
        // For registration, encryption settings are in the response
        if (isRegistering && result.encryptionEnabled !== undefined) {
          familySettings = {
            encryptionEnabled: result.encryptionEnabled,
            encryptionSalt: result.encryptionSalt,
            familyName: result.user.familyName
          };
        } else {
          // For login, fetch settings from API
          familySettings = await api.getFamilySettings();
          familySettings.familyName = result.user.familyName;
        }
        
        await initializeSession(password, familySettings);
        console.log('[Login] Encryption session initialized with settings:', {
          encryptionEnabled: familySettings.encryptionEnabled,
          hasSalt: !!familySettings.encryptionSalt
        });
      } catch (encError) {
        console.error('[Login] Failed to initialize encryption session:', encError);
        // Don't fail login if encryption init fails
      }
      
      onLoginSuccess(result.user, password); // Pass the user data and password for encryption
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setIsRegistering(!isRegistering);
    setError('');
    setEmailError('');
    setFamilyName('');
    setDisplayName('');
    setPassword('');
    setAdminPassword('');
    setAdminEmail('');
    setBetaAccessPassword('');
  };

  return (
    <div style={{
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100vw',
      height: '100vh',
      backgroundColor: 'var(--login-bg)',
      color: 'white',
      overflow: 'hidden',
      zIndex: 1000,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      {/* Main Login Container */}
      <div style={{
        backgroundColor: 'var(--login-panel-bg)',
        borderRadius: '12px',
        padding: '40px',
        boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
        maxWidth: '400px',
        width: '90%',
        textAlign: 'center'
      }}>
        {/* Header */}
        <div style={{
          marginBottom: '30px'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '10px' }}>🌳</div>
          <h2 style={{
            margin: '0 0 10px 0',
            fontSize: '24px',
            color: 'var(--login-text-primary)'
          }}>
            {isRegistering ? appConfig.ui.login.welcome.titleRegister : appConfig.ui.login.welcome.titleLogin}
          </h2>
          {!isRegistering && (
            <p style={{
              fontSize: '14px',
              color: 'var(--login-text-secondary)',
              margin: '0',
              lineHeight: '1.4'
            }}>
              {authStatus?.requiresSetup ? 
                appConfig.ui.login.welcome.setupDescription : 
                appConfig.ui.login.welcome.loginDescription
              }
            </p>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div style={{
            backgroundColor: 'var(--login-error-bg)',
            padding: '12px',
            borderRadius: '6px',
            marginBottom: '20px',
            fontSize: '14px',
            color: 'white'
          }}>
            {error}
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '15px',
          textAlign: 'left'
        }}>
          <TextInput
            label={isRegistering ? appConfig.ui.login.form.familyIdLabel : appConfig.ui.login.form.familyNameLabel}
            value={familyName}
            onChange={(e) => setFamilyName(e.target.value)}
            placeholder={isRegistering ? appConfig.ui.login.form.familyIdPlaceholder : appConfig.ui.login.form.familyNamePlaceholder}
            helperText={isRegistering ? appConfig.ui.login.form.familyIdHint : ''}
          />

          {isRegistering && (
            <TextInput
              label={appConfig.ui.login.form.betaAccessPasswordLabel}
              type="password"
              value={betaAccessPassword}
              onChange={(e) => setBetaAccessPassword(e.target.value)}
              placeholder={appConfig.ui.login.form.betaAccessPasswordPlaceholder}
              helperText={appConfig.ui.login.form.betaAccessPasswordHint}
            />
          )}

          {isRegistering && (
            <TextInput
              label={appConfig.ui.login.form.adminPasswordLabel}
              type="password"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              placeholder={appConfig.ui.login.form.adminPasswordPlaceholder}
              helperText={appConfig.ui.login.form.adminPasswordHint}
            />
          )}

          {isRegistering && (
            <TextInput
              label={appConfig.ui.login.form.adminEmailLabel}
              type="email"
              value={adminEmail}
              onChange={(e) => {
                setAdminEmail(e.target.value);
                setEmailError('');
              }}
              placeholder={appConfig.ui.login.form.adminEmailPlaceholder}
              error={emailError}
              helperText={emailError || appConfig.ui.login.form.adminEmailHint}
            />
          )}

          {isRegistering && (
            <TextInput
              label={appConfig.ui.login.form.displayNameLabel}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={appConfig.ui.login.form.displayNamePlaceholder}
              helperText={appConfig.ui.login.form.displayNameHint}
            />
          )}

          <TextInput
            label={isRegistering ? appConfig.ui.login.form.createPasswordLabel : appConfig.ui.login.form.passwordLabel}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={isRegistering ? appConfig.ui.login.form.createPasswordPlaceholder : appConfig.ui.login.form.passwordPlaceholder}
          />

          <Button
            type="submit"
            variant="success"
            size="large"
            disabled={loading}
            className="w-full mt-2.5"
          >
            {loading ? appConfig.ui.login.buttons.pleaseWait : (isRegistering ? appConfig.ui.login.buttons.register : appConfig.ui.login.buttons.login)}
          </Button>

          {!authStatus?.requiresSetup && (
            <Button
              type="button"
              onClick={toggleMode}
              variant="secondary"
              size="medium"
              className="w-full mt-2.5"
            >
              {isRegistering ? appConfig.ui.login.buttons.switchToLogin : appConfig.ui.login.buttons.switchToRegister}
            </Button>
          )}
        </form>

        {/* Security Notice */}
        <div style={{
          marginTop: '30px',
          paddingTop: '20px',
          borderTop: '1px solid var(--login-border)',
          fontSize: '12px',
          color: 'var(--login-text-muted)',
          textAlign: 'center',
          lineHeight: '1.4'
        }}>
          <p style={{ margin: '5px 0' }}>{appConfig.ui.login.security.privateNotice}</p>
          <p style={{ margin: '5px 0' }}>{appConfig.ui.login.security.authorizedOnly}</p>
        </div>
      </div>

      {/* Contact Button */}
      <ContactButton />
    </div>
  );
}
