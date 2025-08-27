import React, { useState, useEffect } from 'react';
import { api } from './api.js';

export default function Login({ onLoginSuccess }) {
  const [familyName, setFamilyName] = useState('');
  const [password, setPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [authStatus, setAuthStatus] = useState(null);

  // Check if family is already registered
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const status = await api.checkAuthStatus();
        setAuthStatus(status);
        setIsRegistering(status.requiresSetup);
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

    try {
      let result;
      if (isRegistering) {
        result = await api.register(familyName, password);
      } else {
        result = await api.login(familyName, password);
      }

      console.log('Authentication successful:', result);
      onLoginSuccess(result.user, password); // Pass the passphrase for encryption
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setIsRegistering(!isRegistering);
    setError('');
    setFamilyName('');
    setPassword('');
  };

  return (
    <div style={{
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100vw',
      height: '100vh',
      backgroundColor: '#2c3e50',
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
        backgroundColor: '#34495e',
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
            color: '#ecf0f1'
          }}>
            {isRegistering ? 'Setup Your Family Tree' : 'Welcome to AncesTree'}
          </h2>
          <p style={{
            fontSize: '14px',
            color: '#bdc3c7',
            margin: '0',
            lineHeight: '1.4'
          }}>
            {authStatus?.requiresSetup ? 
              'Create your family\'s secure access credentials' : 
              (isRegistering ? 'Set up a new family tree' : 'Sign in to access your family tree')
            }
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div style={{
            backgroundColor: '#e74c3c',
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
          <div>
            <label style={{
              display: 'block',
              marginBottom: '5px',
              fontSize: '14px',
              fontWeight: 'bold',
              color: '#ecf0f1'
            }}>
              Family Name:
            </label>
            <input
              type="text"
              value={familyName}
              onChange={(e) => setFamilyName(e.target.value)}
              placeholder="Enter your family name"
              required
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '6px',
                border: '2px solid #5a6c7d',
                backgroundColor: '#ffffff',
                color: '#2c3e50',
                fontSize: '14px',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div>
            <label style={{
              display: 'block',
              marginBottom: '5px',
              fontSize: '14px',
              fontWeight: 'bold',
              color: '#ecf0f1'
            }}>
              {isRegistering ? 'Create Passphrase:' : 'Passphrase:'}
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={isRegistering ? "Create a secure passphrase" : "Enter your passphrase"}
              required
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '6px',
                border: '2px solid #5a6c7d',
                backgroundColor: '#ffffff',
                color: '#2c3e50',
                fontSize: '14px',
                boxSizing: 'border-box'
              }}
            />
            {isRegistering && (
              <p style={{
                fontSize: '12px',
                color: '#95a5a6',
                margin: '5px 0 0 0',
                lineHeight: '1.3'
              }}>
                This passphrase encrypts all personal data. Choose something memorable but secure.
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              backgroundColor: '#27ae60',
              color: 'white',
              border: 'none',
              padding: '14px',
              borderRadius: '6px',
              fontSize: '16px',
              fontWeight: 'bold',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
              marginTop: '10px'
            }}
          >
            {loading ? 'Please wait...' : (isRegistering ? 'Create Family Access' : 'Access Family Tree')}
          </button>

          {!authStatus?.requiresSetup && (
            <button
              type="button"
              onClick={toggleMode}
              style={{
                backgroundColor: 'transparent',
                color: '#3498db',
                border: '2px solid #3498db',
                padding: '10px',
                borderRadius: '6px',
                fontSize: '14px',
                cursor: 'pointer',
                marginTop: '10px'
              }}
            >
              {isRegistering ? 'Already have access? Sign in' : 'First time? Setup family access'}
            </button>
          )}
        </form>

        {/* Security Notice */}
        <div style={{
          marginTop: '30px',
          paddingTop: '20px',
          borderTop: '1px solid #5a6c7d',
          fontSize: '12px',
          color: '#95a5a6',
          textAlign: 'center',
          lineHeight: '1.4'
        }}>
          <p style={{ margin: '5px 0' }}>🔒 Your family tree is private and secure</p>
          <p style={{ margin: '5px 0' }}>Only family members with the passphrase can access</p>
          <p style={{ margin: '5px 0' }}>All personal data is encrypted on your device</p>
        </div>
      </div>
    </div>
  );
}
