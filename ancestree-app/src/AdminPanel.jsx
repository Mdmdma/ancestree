import React, { useState } from 'react';
import { api } from './api';

const AdminPanel = ({ isOpen, onClose, isAuthenticated, onAuthenticate }) => {
  const [adminPassword, setAdminPassword] = useState('');
  const [newFamilyPassword, setNewFamilyPassword] = useState('');
  const [confirmFamilyPassword, setConfirmFamilyPassword] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [confirmAdminPassword, setConfirmAdminPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [authError, setAuthError] = useState('');

  if (!isOpen) return null;

  const handleAdminLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setAuthError('');

    try {
      await api.adminLogin(adminPassword);
      onAuthenticate();
      setAdminPassword('');
    } catch (err) {
      setAuthError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleChangeFamilyPassword = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    if (newFamilyPassword !== confirmFamilyPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    if (newFamilyPassword.length < 6) {
      setError('Password must be at least 6 characters long');
      setLoading(false);
      return;
    }

    try {
      await api.changeFamilyPassword(newFamilyPassword);
      setSuccess('Family password updated successfully!');
      setNewFamilyPassword('');
      setConfirmFamilyPassword('');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleChangeAdminPassword = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    if (newAdminPassword !== confirmAdminPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    if (newAdminPassword.length < 6) {
      setError('Password must be at least 6 characters long');
      setLoading(false);
      return;
    }

    try {
      await api.changeAdminPassword(newAdminPassword);
      setSuccess('Admin password updated successfully!');
      setNewAdminPassword('');
      setConfirmAdminPassword('');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
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
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: '#2c3e50',
          borderRadius: '12px',
          padding: '30px',
          maxWidth: '500px',
          width: '90%',
          maxHeight: '90vh',
          overflow: 'auto',
          boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
          color: 'white'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '25px',
          borderBottom: '2px solid #34495e',
          paddingBottom: '15px'
        }}>
          <h2 style={{ margin: 0, fontSize: '24px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span>⚙️</span> Admin Panel
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#ecf0f1',
              fontSize: '28px',
              cursor: 'pointer',
              padding: '0',
              lineHeight: '1'
            }}
          >
            ×
          </button>
        </div>

        {/* Authentication Section */}
        {!isAuthenticated ? (
          <form onSubmit={handleAdminLogin} style={{ marginBottom: '20px' }}>
            <div style={{
              backgroundColor: '#34495e',
              padding: '20px',
              borderRadius: '8px',
              marginBottom: '20px'
            }}>
              <h3 style={{ marginTop: 0, fontSize: '18px', marginBottom: '15px' }}>
                🔐 Admin Authentication Required
              </h3>
              <p style={{ fontSize: '14px', color: '#bdc3c7', marginBottom: '15px' }}>
                Enter the admin password to access panel settings.
                <br />
                <small style={{ color: '#95a5a6' }}>Default password: adminn</small>
              </p>
              
              <input
                type="password"
                placeholder="Admin Password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '6px',
                  border: 'none',
                  marginBottom: '10px',
                  fontSize: '14px',
                  boxSizing: 'border-box'
                }}
                disabled={loading}
              />

              {authError && (
                <div style={{
                  backgroundColor: '#e74c3c',
                  color: 'white',
                  padding: '10px',
                  borderRadius: '6px',
                  marginBottom: '10px',
                  fontSize: '14px'
                }}>
                  {authError}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !adminPassword}
                style={{
                  width: '100%',
                  padding: '12px',
                  backgroundColor: loading ? '#95a5a6' : '#27ae60',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  transition: 'background-color 0.2s'
                }}
              >
                {loading ? 'Authenticating...' : 'Authenticate'}
              </button>
            </div>
          </form>
        ) : (
          <>
            {/* Success/Error Messages */}
            {success && (
              <div style={{
                backgroundColor: '#27ae60',
                color: 'white',
                padding: '12px',
                borderRadius: '6px',
                marginBottom: '20px',
                fontSize: '14px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <span>✓</span> {success}
              </div>
            )}

            {error && (
              <div style={{
                backgroundColor: '#e74c3c',
                color: 'white',
                padding: '12px',
                borderRadius: '6px',
                marginBottom: '20px',
                fontSize: '14px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <span>⚠</span> {error}
              </div>
            )}

            {/* Change Family Password Section */}
            <form onSubmit={handleChangeFamilyPassword} style={{ marginBottom: '25px' }}>
              <div style={{
                backgroundColor: '#34495e',
                padding: '20px',
                borderRadius: '8px'
              }}>
                <h3 style={{ marginTop: 0, fontSize: '18px', marginBottom: '10px' }}>
                  👨‍👩‍👧‍👦 Change Family Password
                </h3>
                <p style={{ fontSize: '13px', color: '#bdc3c7', marginBottom: '15px' }}>
                  This password is used by all family members to access the tree.
                </p>

                <input
                  type="password"
                  placeholder="New Family Password"
                  value={newFamilyPassword}
                  onChange={(e) => setNewFamilyPassword(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '6px',
                    border: 'none',
                    marginBottom: '10px',
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}
                  disabled={loading}
                />

                <input
                  type="password"
                  placeholder="Confirm Family Password"
                  value={confirmFamilyPassword}
                  onChange={(e) => setConfirmFamilyPassword(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '6px',
                    border: 'none',
                    marginBottom: '15px',
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}
                  disabled={loading}
                />

                <button
                  type="submit"
                  disabled={loading || !newFamilyPassword || !confirmFamilyPassword}
                  style={{
                    width: '100%',
                    padding: '10px',
                    backgroundColor: loading || !newFamilyPassword || !confirmFamilyPassword ? '#95a5a6' : '#3498db',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: loading || !newFamilyPassword || !confirmFamilyPassword ? 'not-allowed' : 'pointer',
                    transition: 'background-color 0.2s'
                  }}
                >
                  {loading ? 'Updating...' : 'Update Family Password'}
                </button>
              </div>
            </form>

            {/* Change Admin Password Section */}
            <form onSubmit={handleChangeAdminPassword}>
              <div style={{
                backgroundColor: '#34495e',
                padding: '20px',
                borderRadius: '8px'
              }}>
                <h3 style={{ marginTop: 0, fontSize: '18px', marginBottom: '10px' }}>
                  🔐 Change Admin Password
                </h3>
                <p style={{ fontSize: '13px', color: '#bdc3c7', marginBottom: '15px' }}>
                  This password is used to access this admin panel.
                </p>

                <input
                  type="password"
                  placeholder="New Admin Password"
                  value={newAdminPassword}
                  onChange={(e) => setNewAdminPassword(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '6px',
                    border: 'none',
                    marginBottom: '10px',
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}
                  disabled={loading}
                />

                <input
                  type="password"
                  placeholder="Confirm Admin Password"
                  value={confirmAdminPassword}
                  onChange={(e) => setConfirmAdminPassword(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '6px',
                    border: 'none',
                    marginBottom: '15px',
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}
                  disabled={loading}
                />

                <button
                  type="submit"
                  disabled={loading || !newAdminPassword || !confirmAdminPassword}
                  style={{
                    width: '100%',
                    padding: '10px',
                    backgroundColor: loading || !newAdminPassword || !confirmAdminPassword ? '#95a5a6' : '#e67e22',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: loading || !newAdminPassword || !confirmAdminPassword ? 'not-allowed' : 'pointer',
                    transition: 'background-color 0.2s'
                  }}
                >
                  {loading ? 'Updating...' : 'Update Admin Password'}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
};

export default AdminPanel;
