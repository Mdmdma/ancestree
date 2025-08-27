import React, { useState } from 'react';
import { api } from './api';
import { decryptNodes } from './utils/encryption';
import './App.css'; // Use the main app styles

export default function PassphrasePrompt({ user, onPassphraseEntered, onLogout }) {
  const [passphrase, setPassphrase] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!passphrase.trim()) {
      setError('Please enter your passphrase');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Fetch a sample of encrypted data to validate passphrase
      const response = await fetch(`${api.API_BASE_URL || 'http://localhost:3001/api'}/nodes`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch data for validation');
      }

      const encryptedNodes = await response.json();
      
      if (encryptedNodes.length > 0) {
        // Try to decrypt the first node to validate passphrase
        const testDecryption = decryptNodes([encryptedNodes[0]], passphrase);
        
        // Simple validation: check if decryption didn't return the same encrypted string
        const firstNode = testDecryption[0];
        if (firstNode?.data?.name && firstNode.data.name === encryptedNodes[0].data.name) {
          // If decrypted value equals encrypted value, passphrase is likely wrong
          // (unless the actual name was the encrypted string, which is highly unlikely)
          if (encryptedNodes[0].data.name.startsWith('U2FsdGVkX1')) {
            throw new Error('Invalid passphrase');
          }
        }
      }

      // Passphrase appears valid, pass it to parent
      onPassphraseEntered(passphrase);
    } catch (error) {
      console.error('Passphrase validation error:', error);
      setError('Invalid passphrase. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container expanded">
      <div className="login-content">
        <div className="login-header">
          <h2>Welcome back, {user?.familyName}!</h2>
          <p>Please enter your passphrase to decrypt your family tree data.</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="passphrase">Passphrase:</label>
            <input
              type="password"
              id="passphrase"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              placeholder="Enter your family passphrase"
              disabled={loading}
              autoFocus
            />
          </div>

          {error && <div className="error-message">{error}</div>}

          <div className="button-group">
            <button type="submit" disabled={loading} className="primary-button">
              {loading ? 'Unlocking...' : 'Unlock Family Tree'}
            </button>
            <button type="button" onClick={onLogout} className="secondary-button">
              Logout
            </button>
          </div>
        </form>

        <div className="security-notice">
          <p><strong>Security Notice:</strong> Your passphrase is used to encrypt personal information. 
          For security reasons, you need to re-enter it each time you visit the site.</p>
        </div>
      </div>
    </div>
  );
}
