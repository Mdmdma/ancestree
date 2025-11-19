import React, { useState, useEffect } from 'react';
import { api } from './api';
import { appConfig } from './config';

const AdminPanel = ({ isOpen, onClose, isAuthenticated, onAuthenticate, familyName }) => {
  const [adminPassword, setAdminPassword] = useState('');
  const [newFamilyPassword, setNewFamilyPassword] = useState('');
  const [confirmFamilyPassword, setConfirmFamilyPassword] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [confirmAdminPassword, setConfirmAdminPassword] = useState('');
  const [purposePreview, setPurposePreview] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [currentFamilyPassword, setCurrentFamilyPassword] = useState('');
  const [activeTab, setActiveTab] = useState('familyParameters');
  const [encryptionEnabled, setEncryptionEnabled] = useState(false);
  const [encryptionSalt, setEncryptionSalt] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [authError, setAuthError] = useState('');
  const [encryptionProgress, setEncryptionProgress] = useState(null);

  useEffect(() => {
    if (!isOpen) return;

    // fetch public purpose preview
    const fetchPurpose = async () => {
      try {
        if (familyName) {
          const res = await api.getFamilyPurpose(familyName);
          setPurposePreview(res.purpose || '');
        }
      } catch (err) {
        console.error('Failed to fetch family purpose preview:', err);
      }
    };

    // fetch protected settings if authenticated
    const fetchSettings = async () => {
      try {
        const settings = await api.getFamilySettings();
        setDisplayName(settings.displayName || '');
        setEncryptionEnabled(Boolean(settings.encryptionEnabled));
        setEncryptionSalt(settings.encryptionSalt || null);
      } catch (err) {
        // ignore if not authenticated
      }
    };

    fetchPurpose();
    fetchSettings();
  }, [isOpen, familyName]);

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
      // If encryption is enabled, re-encrypt data with new password on client
      if (encryptionEnabled) {
        if (!currentFamilyPassword) {
          setError('Current family password is required to re-encrypt data');
          setLoading(false);
          return;
        }
        const { encryptedApi } = await import('./encryptedApi');
        await encryptedApi.reEncryptWithNewPassword(currentFamilyPassword, newFamilyPassword, (progress) => {
          setEncryptionProgress(progress);
        });
        setEncryptionProgress(null);
      }

      await api.changeFamilyPassword(newFamilyPassword);
      setSuccess('Family password updated successfully!');
      setNewFamilyPassword('');
      setConfirmFamilyPassword('');
      setCurrentFamilyPassword('');
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
            <span>⚙️</span> {appConfig.ui.adminPanel.title}
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
        {/* Authentication / Preview Section */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{
            backgroundColor: '#34495e',
            padding: '16px',
            borderRadius: '8px',
            marginBottom: '12px'
          }}>
            <h3 style={{ marginTop: 0, fontSize: '16px', marginBottom: '8px' }}>
              {appConfig.ui.adminPanel.familyParameters.title}
            </h3>
            <p style={{ fontSize: '13px', color: '#bdc3c7', marginBottom: '8px' }}>
              {purposePreview || appConfig.ui.adminPanelCommon.noDescription}
            </p>
          </div>

          {!isAuthenticated ? (
            <form onSubmit={handleAdminLogin}>
              <div style={{
                backgroundColor: '#34495e',
                padding: '18px',
                borderRadius: '8px'
              }}>
                <h3 style={{ marginTop: 0, fontSize: '18px', marginBottom: '10px' }}>
                  🔐 {appConfig.ui.adminPanel.title}
                </h3>
                <p style={{ fontSize: '14px', color: '#bdc3c7', marginBottom: '10px' }}>
                  {appConfig.ui.adminPanel.authPrompt}
                  <br />
                  <small style={{ color: '#95a5a6' }}>{appConfig.ui.adminPanel.defaultAdminNote}</small>
                </p>

                <input
                  type="password"
                  placeholder={appConfig.ui.adminPanel.authPrompt}
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
                  {loading ? appConfig.ui.adminPanelCommon.authenticating : appConfig.ui.adminPanelCommon.authenticateButton}
                </button>
              </div>
            </form>
          ) : null}
        </div>

        {/* If authenticated show tabs */}
        {isAuthenticated ? (
          <div style={{ display: 'flex', gap: '16px' }}>
            {/* Side menu */}
            <div style={{ width: '160px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button onClick={() => setActiveTab('familyParameters')} style={{ padding: '10px', borderRadius: '6px', background: activeTab === 'familyParameters' ? '#3b5770' : 'transparent', color: 'white', border: '1px solid #34495e', textAlign: 'left' }}>{appConfig.ui.adminPanel.menu.familyParameters}</button>
              <button onClick={() => setActiveTab('passwords')} style={{ padding: '10px', borderRadius: '6px', background: activeTab === 'passwords' ? '#3b5770' : 'transparent', color: 'white', border: '1px solid #34495e', textAlign: 'left' }}>{appConfig.ui.adminPanel.menu.passwords}</button>
              <button onClick={() => setActiveTab('security')} style={{ padding: '10px', borderRadius: '6px', background: activeTab === 'security' ? '#3b5770' : 'transparent', color: 'white', border: '1px solid #34495e', textAlign: 'left' }}>{appConfig.ui.adminPanel.menu.security}</button>
            </div>

            {/* Content area */}
            <div style={{ flex: 1 }}>
              {success && (
                <div style={{
                  backgroundColor: '#27ae60',
                  color: 'white',
                  padding: '12px',
                  borderRadius: '6px',
                  marginBottom: '12px',
                  fontSize: '14px'
                }}>
                  {success}
                </div>
              )}

              {error && (
                <div style={{
                  backgroundColor: '#e74c3c',
                  color: 'white',
                  padding: '12px',
                  borderRadius: '6px',
                  marginBottom: '12px',
                  fontSize: '14px'
                }}>
                  {error}
                </div>
              )}

              {activeTab === 'familyParameters' && (
                <div style={{ backgroundColor: '#34495e', padding: '20px', borderRadius: '8px' }}>
                  <h3 style={{ marginTop: 0 }}>{appConfig.ui.adminPanel.familyParameters.title}</h3>
                  <label style={{ display: 'block', marginBottom: '6px' }}>{appConfig.ui.adminPanel.familyParameters.displayNameLabel}</label>
                  <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: 'none', marginBottom: '10px' }} />
                  <label style={{ display: 'block', marginBottom: '6px' }}>{appConfig.ui.adminPanel.familyParameters.purposeLabel}</label>
                  <textarea value={purposePreview} onChange={(e) => setPurposePreview(e.target.value)} rows={4} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: 'none', marginBottom: '10px' }} />
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={async () => { setLoading(true); setError(''); setSuccess(''); try { await api.updateDisplayName(displayName); await api.updatePurpose(purposePreview); setSuccess('Family parameters updated'); } catch (err) { setError(err.message); } finally { setLoading(false); setTimeout(() => setSuccess(''), 3000); } }} disabled={loading} style={{ padding: '10px', borderRadius: '6px', background: '#3498db', color: 'white', border: 'none' }}>{appConfig.ui.adminPanel.familyParameters.saveButton}</button>
                  </div>
                </div>
              )}

              {activeTab === 'passwords' && (
                <div>
                  <form onSubmit={handleChangeFamilyPassword} style={{ backgroundColor: '#34495e', padding: '20px', borderRadius: '8px' }}>
                    <h3 style={{ marginTop: 0 }}>{appConfig.ui.adminPanel.passwords.title}</h3>
                    <label style={{ display: 'block', marginBottom: '6px' }}>{appConfig.ui.adminPanel.passwords.familyPasswordLabel}</label>
                    
                    {/* Encryption Progress Display in Password Tab */}
                    {encryptionProgress && (
                      <div style={{
                        backgroundColor: '#2c3e50',
                        padding: '15px',
                        borderRadius: '8px',
                        marginBottom: '15px'
                      }}>
                        <div style={{ marginBottom: '10px', color: '#ecf0f1', fontSize: '14px' }}>
                          {encryptionProgress.message}
                        </div>
                        <div style={{
                          width: '100%',
                          height: '24px',
                          backgroundColor: '#1a252f',
                          borderRadius: '12px',
                          overflow: 'hidden',
                          position: 'relative'
                        }}>
                          <div style={{
                            width: `${encryptionProgress.percent}%`,
                            height: '100%',
                            backgroundColor: encryptionProgress.phase === 'complete' ? '#27ae60' : '#3498db',
                            transition: 'width 0.3s ease',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '12px',
                            fontWeight: 'bold',
                            color: 'white'
                          }}>
                            {encryptionProgress.percent}%
                          </div>
                        </div>
                        {encryptionProgress.total && (
                          <div style={{ marginTop: '8px', color: '#95a5a6', fontSize: '12px' }}>
                            {encryptionProgress.current} / {encryptionProgress.total} items
                          </div>
                        )}
                      </div>
                    )}
                    
                    {encryptionEnabled && (
                      <div style={{ marginBottom: '10px' }}>
                        <label style={{ display: 'block', marginBottom: '6px' }}>{appConfig.ui.adminPanelCommon.currentFamilyPasswordLabel}</label>
                        <input type="password" placeholder="Current Family Password" value={currentFamilyPassword} onChange={(e) => setCurrentFamilyPassword(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: 'none', marginBottom: '10px' }} disabled={loading || encryptionProgress !== null} />
                      </div>
                    )}
                    <input type="password" placeholder="New Family Password" value={newFamilyPassword} onChange={(e) => setNewFamilyPassword(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: 'none', marginBottom: '10px' }} disabled={loading || encryptionProgress !== null} />
                    <input type="password" placeholder="Confirm Family Password" value={confirmFamilyPassword} onChange={(e) => setConfirmFamilyPassword(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: 'none', marginBottom: '10px' }} disabled={loading || encryptionProgress !== null} />
                    <button type="submit" disabled={loading || encryptionProgress !== null || !newFamilyPassword || !confirmFamilyPassword} style={{ padding: '10px', borderRadius: '6px', background: (loading || encryptionProgress !== null) ? '#95a5a6' : '#3498db', color: 'white', border: 'none' }}>{appConfig.ui.adminPanel.passwords.saveButton}</button>
                  </form>

                  <form onSubmit={handleChangeAdminPassword} style={{ marginTop: '12px', backgroundColor: '#34495e', padding: '20px', borderRadius: '8px' }}>
                    <h3 style={{ marginTop: 0 }}>{appConfig.ui.adminPanel.passwords.title} - Admin</h3>
                    <label style={{ display: 'block', marginBottom: '6px' }}>{appConfig.ui.adminPanel.passwords.adminPasswordLabel}</label>
                    <input type="password" placeholder="New Admin Password" value={newAdminPassword} onChange={(e) => setNewAdminPassword(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: 'none', marginBottom: '10px' }} />
                    <input type="password" placeholder="Confirm Admin Password" value={confirmAdminPassword} onChange={(e) => setConfirmAdminPassword(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: 'none', marginBottom: '10px' }} />
                    <button type="submit" disabled={loading || !newAdminPassword || !confirmAdminPassword} style={{ padding: '10px', borderRadius: '6px', background: '#e67e22', color: 'white', border: 'none' }}>{appConfig.ui.adminPanel.passwords.saveButton}</button>
                  </form>
                </div>
              )}

              {activeTab === 'security' && (
                <div style={{ backgroundColor: '#34495e', padding: '20px', borderRadius: '8px' }}>
                  <h3 style={{ marginTop: 0 }}>{appConfig.ui.adminPanel.security.title}</h3>
                  <p style={{ color: '#bdc3c7' }}>{appConfig.ui.adminPanel.security.encryptionHint}</p>
                  
                  {/* Encryption Progress Display */}
                  {encryptionProgress && (
                    <div style={{
                      backgroundColor: '#2c3e50',
                      padding: '15px',
                      borderRadius: '8px',
                      marginBottom: '15px'
                    }}>
                      <div style={{ marginBottom: '10px', color: '#ecf0f1', fontSize: '14px' }}>
                        {encryptionProgress.message}
                      </div>
                      <div style={{
                        width: '100%',
                        height: '24px',
                        backgroundColor: '#1a252f',
                        borderRadius: '12px',
                        overflow: 'hidden',
                        position: 'relative'
                      }}>
                        <div style={{
                          width: `${encryptionProgress.percent}%`,
                          height: '100%',
                          backgroundColor: encryptionProgress.phase === 'complete' ? '#27ae60' : '#3498db',
                          transition: 'width 0.3s ease',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '12px',
                          fontWeight: 'bold',
                          color: 'white'
                        }}>
                          {encryptionProgress.percent}%
                        </div>
                      </div>
                      {encryptionProgress.total && (
                        <div style={{ marginTop: '8px', color: '#95a5a6', fontSize: '12px' }}>
                          {encryptionProgress.current} / {encryptionProgress.total} items
                        </div>
                      )}
                    </div>
                  )}
                  
                  <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <label style={{ color: 'white', flex: 1 }}>{appConfig.ui.adminPanel.security.encryptionLabel}</label>
                    <button
                      disabled={loading || encryptionProgress !== null}
                      onClick={async () => {
                        const enabled = !encryptionEnabled;
                        setLoading(true);
                        setError('');
                        setSuccess('');
                        setEncryptionProgress({ phase: 'loading', percent: 0, message: 'Initializing...' });
                        try {
                          if (enabled) {
                            // enable encryption via encryptedApi
                            const { encryptedApi } = await import('./encryptedApi');
                            await encryptedApi.enableEncryption((progress) => {
                              setEncryptionProgress(progress);
                            });
                            setEncryptionEnabled(true);
                          } else {
                            const { encryptedApi } = await import('./encryptedApi');
                            await encryptedApi.disableEncryption((progress) => {
                              setEncryptionProgress(progress);
                            });
                            setEncryptionEnabled(false);
                          }
                          setSuccess(enabled ? 'Encryption enabled' : 'Encryption disabled');
                        } catch (err) {
                          setError(err.message);
                          // Revert state on error
                          setEncryptionEnabled(!enabled);
                        } finally {
                          setLoading(false);
                          setEncryptionProgress(null);
                          setTimeout(() => setSuccess(''), 3000);
                        }
                      }}
                      style={{
                        position: 'relative',
                        width: '60px',
                        height: '30px',
                        borderRadius: '15px',
                        border: 'none',
                        cursor: (loading || encryptionProgress !== null) ? 'not-allowed' : 'pointer',
                        backgroundColor: encryptionEnabled ? '#27ae60' : '#7f8c8d',
                        transition: 'background-color 0.3s ease',
                        opacity: (loading || encryptionProgress !== null) ? 0.6 : 1,
                        padding: 0
                      }}
                    >
                      <div style={{
                        position: 'absolute',
                        top: '3px',
                        left: encryptionEnabled ? '33px' : '3px',
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        backgroundColor: 'white',
                        transition: 'left 0.3s ease',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                      }} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default AdminPanel;
