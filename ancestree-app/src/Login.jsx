import React, { useState, useEffect } from 'react';
import { api } from './api.js';

export default function Login({ onLoginSuccess, isExpanded, onToggleExpanded }) {
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
      width: isExpanded ? '320px' : '60px',
      height: '100vh',
      backgroundColor: '#2c3e50',
      color: 'white',
      transition: 'width 0.3s ease',
      overflow: 'hidden',
      zIndex: 1000,
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Toggle Button */}
      <button
        onClick={onToggleExpanded}
        style={{
          backgroundColor: '#34495e',
          border: 'none',
          color: 'white',
          padding: '15px',
          cursor: 'pointer',
          fontSize: '16px',
          fontWeight: 'bold',
          borderBottom: '1px solid #3e5465',
          display: 'flex',
          alignItems: 'center',
          justifyContent: isExpanded ? 'flex-start' : 'center',
          gap: '10px'
        }}
      >
        <span style={{ fontSize: '18px' }}>🔐</span>
        {isExpanded && (
          <span>
            {authStatus?.requiresSetup ? 'Setup Family' : 'Family Login'}
          </span>
        )}
      </button>

      {/* Login Form */}
      {isExpanded && (
        <div style={{
          padding: '20px',
          flex: 1,
          display: 'flex',
          flexDirection: 'column'
        }}>
          <div style={{
            marginBottom: '20px',
            textAlign: 'center'
          }}>
            <h3 style={{
              margin: '0 0 10px 0',
              fontSize: '18px',
              color: '#ecf0f1'
            }}>
              {isRegistering ? 'Setup Your Family Tree' : 'Access Family Tree'}
            </h3>
            {authStatus?.requiresSetup && (
              <p style={{
                fontSize: '12px',
                color: '#bdc3c7',
                margin: '0',
                lineHeight: '1.4'
              }}>
                Create your family credentials to secure your family tree
              </p>
            )}
          </div>

          <form onSubmit={handleSubmit} style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '15px'
          }}>
            <div>
              <label style={{
                display: 'block',
                marginBottom: '5px',
                fontSize: '14px',
                color: '#ecf0f1'
              }}>
                Family Name
              </label>
              <input
                type="text"
                value={familyName}
                onChange={(e) => setFamilyName(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #34495e',
                  borderRadius: '4px',
                  fontSize: '14px',
                  backgroundColor: '#34495e',
                  color: 'white',
                  boxSizing: 'border-box'
                }}
                placeholder="Enter your family name"
              />
            </div>

            <div>
              <label style={{
                display: 'block',
                marginBottom: '5px',
                fontSize: '14px',
                color: '#ecf0f1'
              }}>
                Passphrase
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={isRegistering ? 6 : 1}
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #34495e',
                  borderRadius: '4px',
                  fontSize: '14px',
                  backgroundColor: '#34495e',
                  color: 'white',
                  boxSizing: 'border-box'
                }}
                placeholder={isRegistering ? "Choose a secure passphrase (min 6 chars)" : "Enter your passphrase"}
              />
            </div>

            {error && (
              <div style={{
                backgroundColor: '#e74c3c',
                color: 'white',
                padding: '10px',
                borderRadius: '4px',
                fontSize: '12px',
                textAlign: 'center'
              }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                backgroundColor: '#27ae60',
                color: 'white',
                border: 'none',
                padding: '12px',
                borderRadius: '4px',
                fontSize: '14px',
                fontWeight: 'bold',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1
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
                  border: '1px solid #3498db',
                  padding: '8px',
                  borderRadius: '4px',
                  fontSize: '12px',
                  cursor: 'pointer',
                  marginTop: '10px'
                }}
              >
                {isRegistering ? 'Already have access? Sign in' : 'First time? Setup family access'}
              </button>
            )}
          </form>

          <div style={{
            marginTop: 'auto',
            paddingTop: '20px',
            borderTop: '1px solid #34495e',
            fontSize: '11px',
            color: '#95a5a6',
            textAlign: 'center',
            lineHeight: '1.4'
          }}>
            <p style={{ margin: '5px 0' }}>🔒 Your family tree is private and secure</p>
            <p style={{ margin: '5px 0' }}>Only family members with the passphrase can access</p>
          </div>
        </div>
      )}
    </div>
  );
}
