import React, { useState, useEffect } from 'react';
import { api } from './api';
import { appConfig } from './config';
import { runEncryptionPerformanceTest, formatTestResults, getDatabaseFieldEstimates } from './encryptionPerformanceTest';
import { enableEncryption, disableEncryption } from './encryptionBatchOperations';
import { updateEncryptionStatus, updateSkipGeocoding as updateSessionSkipGeocoding, getFamilyPassword } from './encryptionSession';

const AdminPanel = ({ isOpen, onClose, isAuthenticated, onAuthenticate, familyName, onDataReload }) => {
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
  const [skipGeocoding, setSkipGeocoding] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [authError, setAuthError] = useState('');
  const [encryptionProgress, setEncryptionProgress] = useState(null);
  
  // Password confirmation dialog state
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [passwordForEncryption, setPasswordForEncryption] = useState('');
  const [pendingEncryptionAction, setPendingEncryptionAction] = useState(null); // 'enable' or 'disable'
  const [passwordDialogError, setPasswordDialogError] = useState('');
  
  // Performance test state
  const [testRunning, setTestRunning] = useState(false);
  const [testProgress, setTestProgress] = useState(null);
  const [testResults, setTestResults] = useState(null);
  const [testConfig, setTestConfig] = useState({
    fieldCount: 10000,
    folds: 10,
    withPadding: true
  });

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
        setSkipGeocoding(Boolean(settings.skipGeocoding));
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

  const handleRunPerformanceTest = async () => {
    setTestRunning(true);
    setTestProgress({ phase: 'starting', percent: 0, message: 'Initializing test...' });
    setTestResults(null);
    setError('');
    
    try {
      const results = await runEncryptionPerformanceTest({
        fieldCount: testConfig.fieldCount,
        folds: testConfig.folds,
        withPadding: testConfig.withPadding,
        onProgress: (progress) => {
          setTestProgress(progress);
        }
      });
      
      setTestResults(results);
      setTestProgress({ phase: 'complete', percent: 100, message: 'Test complete!' });
    } catch (err) {
      setError('Test failed: ' + err.message);
      console.error('Performance test error:', err);
    } finally {
      setTestRunning(false);
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
              <button onClick={() => setActiveTab('test')} style={{ padding: '10px', borderRadius: '6px', background: activeTab === 'test' ? '#3b5770' : 'transparent', color: 'white', border: '1px solid #34495e', textAlign: 'left' }}>🧪 Test</button>
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
                      onClick={() => {
                        // Show password dialog to confirm encryption toggle
                        setPendingEncryptionAction(encryptionEnabled ? 'disable' : 'enable');
                        setShowPasswordDialog(true);
                        setPasswordForEncryption('');
                        setPasswordDialogError('');
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
                  
                  {/* Skip Geocoding Toggle */}
                  <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <label style={{ color: 'white', flex: 1 }}>
                      Skip Geocoding
                      <div style={{ fontSize: '12px', color: '#bdc3c7', marginTop: '4px' }}>
                        When enabled, coordinates are sent to server for geocoding (not zero-knowledge)
                      </div>
                    </label>
                    <button
                      disabled={loading}
                      onClick={async () => {
                        const newValue = !skipGeocoding;
                        setLoading(true);
                        setError('');
                        setSuccess('');
                        try {
                          await api.updateSkipGeocoding(newValue);
                          setSkipGeocoding(newValue);
                          updateSessionSkipGeocoding(newValue);
                          setSuccess(`Geocoding ${newValue ? 'disabled' : 'enabled'}`);
                          setTimeout(() => setSuccess(''), 3000);
                        } catch (err) {
                          setError(`Failed to update geocoding: ${err.message}`);
                        } finally {
                          setLoading(false);
                        }
                      }}
                      style={{
                        position: 'relative',
                        width: '60px',
                        height: '30px',
                        borderRadius: '15px',
                        border: 'none',
                        cursor: loading ? 'not-allowed' : 'pointer',
                        backgroundColor: skipGeocoding ? '#27ae60' : '#7f8c8d',
                        transition: 'background-color 0.3s ease',
                        opacity: loading ? 0.6 : 1,
                        padding: 0
                      }}
                    >
                      <div style={{
                        position: 'absolute',
                        top: '3px',
                        left: skipGeocoding ? '33px' : '3px',
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

              {activeTab === 'test' && (
                <div style={{ backgroundColor: '#34495e', padding: '20px', borderRadius: '8px' }}>
                  <h3 style={{ marginTop: 0 }}>🧪 Encryption Performance Test</h3>
                  <p style={{ color: '#bdc3c7', fontSize: '14px', marginBottom: '20px' }}>
                    Test the performance implications of encrypting all database fields separately with padding.
                    This simulates a worst-case scenario for field-level encryption.
                  </p>

                  {/* Test Configuration */}
                  <div style={{ backgroundColor: '#2c3e50', padding: '15px', borderRadius: '8px', marginBottom: '15px' }}>
                    <h4 style={{ marginTop: 0, marginBottom: '15px', fontSize: '16px' }}>Test Configuration</h4>
                    
                    <div style={{ marginBottom: '12px' }}>
                      <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px' }}>
                        Number of Fields: {testConfig.fieldCount.toLocaleString()}
                      </label>
                      <input
                        type="range"
                        min="100"
                        max="20000"
                        step="1000"
                        value={testConfig.fieldCount}
                        onChange={(e) => setTestConfig({ ...testConfig, fieldCount: parseInt(e.target.value) })}
                        disabled={testRunning}
                        style={{ width: '100%' }}
                      />
                    </div>

                    <div style={{ marginBottom: '12px' }}>
                      <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px' }}>
                        Test Folds (Iterations): {testConfig.folds}
                      </label>
                      <input
                        type="range"
                        min="1"
                        max="20"
                        step="1"
                        value={testConfig.folds}
                        onChange={(e) => setTestConfig({ ...testConfig, folds: parseInt(e.target.value) })}
                        disabled={testRunning}
                        style={{ width: '100%' }}
                      />
                    </div>

                    <div style={{ marginBottom: '12px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
                        <input
                          type="checkbox"
                          checked={testConfig.withPadding}
                          onChange={(e) => setTestConfig({ ...testConfig, withPadding: e.target.checked })}
                          disabled={testRunning}
                        />
                        Use Padding (256 chars) - Recommended for production
                      </label>
                      <p style={{ fontSize: '12px', color: '#95a5a6', marginTop: '4px', marginLeft: '24px' }}>
                        Padding hides the actual length of encrypted data for better security.
                      </p>
                    </div>
                  </div>

                  {/* Database Context */}
                  <div style={{ backgroundColor: '#2c3e50', padding: '15px', borderRadius: '8px', marginBottom: '15px' }}>
                    <h4 style={{ marginTop: 0, marginBottom: '10px', fontSize: '16px' }}>Database Context</h4>
                    <div style={{ fontSize: '13px', color: '#ecf0f1' }}>
                      {(() => {
                        const estimates = getDatabaseFieldEstimates();
                        return (
                          <>
                            <p style={{ margin: '4px 0' }}>• Typical tree: {estimates.estimatedTotal}</p>
                            <p style={{ margin: '4px 0' }}>• Large tree: {estimates.largeTree}</p>
                            <p style={{ margin: '8px 0 4px', fontSize: '12px', color: '#95a5a6' }}>
                              Testing with {testConfig.fieldCount.toLocaleString()} fields simulates a {
                                testConfig.fieldCount < 3000 ? 'typical' :
                                testConfig.fieldCount < 8000 ? 'large' : 'very large'
                              } family tree.
                            </p>
                          </>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Progress Display */}
                  {testProgress && (
                    <div style={{ backgroundColor: '#2c3e50', padding: '15px', borderRadius: '8px', marginBottom: '15px' }}>
                      <div style={{ marginBottom: '10px', color: '#ecf0f1', fontSize: '14px' }}>
                        {testProgress.message}
                        {testProgress.fold && ` (Fold ${testProgress.fold}/${testProgress.totalFolds})`}
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
                          width: `${testProgress.percent}%`,
                          height: '100%',
                          backgroundColor: testProgress.phase === 'complete' ? '#27ae60' : '#3498db',
                          transition: 'width 0.3s ease',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '12px',
                          fontWeight: 'bold',
                          color: 'white'
                        }}>
                          {testProgress.percent?.toFixed(0)}%
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Run Test Button */}
                  <button
                    onClick={handleRunPerformanceTest}
                    disabled={testRunning}
                    style={{
                      width: '100%',
                      padding: '12px',
                      backgroundColor: testRunning ? '#95a5a6' : '#3498db',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '16px',
                      fontWeight: '600',
                      cursor: testRunning ? 'not-allowed' : 'pointer',
                      marginBottom: '15px'
                    }}
                  >
                    {testRunning ? '⏳ Running Test...' : '▶️ Run Performance Test'}
                  </button>

                  {/* Results Display */}
                  {testResults && (
                    <div style={{ backgroundColor: '#2c3e50', padding: '15px', borderRadius: '8px' }}>
                      <h4 style={{ marginTop: 0, marginBottom: '15px', fontSize: '16px' }}>Test Results</h4>
                      <pre style={{
                        backgroundColor: '#1a252f',
                        padding: '15px',
                        borderRadius: '6px',
                        fontSize: '12px',
                        lineHeight: '1.6',
                        overflow: 'auto',
                        maxHeight: '400px',
                        color: '#ecf0f1',
                        fontFamily: 'Monaco, Consolas, "Courier New", monospace',
                        whiteSpace: 'pre-wrap',
                        wordWrap: 'break-word'
                      }}>
                        {formatTestResults(testResults)}
                      </pre>
                      
                      {/* Quick Summary Cards */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px', marginTop: '15px' }}>
                        <div style={{ backgroundColor: '#1a252f', padding: '12px', borderRadius: '6px', textAlign: 'center' }}>
                          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#3498db' }}>
                            {testResults.summary.throughput.fieldsPerSecondEncryption}
                          </div>
                          <div style={{ fontSize: '12px', color: '#95a5a6', marginTop: '4px' }}>
                            Enc/sec
                          </div>
                        </div>
                        <div style={{ backgroundColor: '#1a252f', padding: '12px', borderRadius: '6px', textAlign: 'center' }}>
                          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#2ecc71' }}>
                            {testResults.summary.throughput.fieldsPerSecondDecryption}
                          </div>
                          <div style={{ fontSize: '12px', color: '#95a5a6', marginTop: '4px' }}>
                            Dec/sec
                          </div>
                        </div>
                        <div style={{ backgroundColor: '#1a252f', padding: '12px', borderRadius: '6px', textAlign: 'center' }}>
                          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#e74c3c' }}>
                            {testResults.summary.dataOverhead}
                          </div>
                          <div style={{ fontSize: '12px', color: '#95a5a6', marginTop: '4px' }}>
                            Overhead
                          </div>
                        </div>
                      </div>

                      {/* Export Button */}
                      <button
                        onClick={() => {
                          const blob = new Blob([formatTestResults(testResults)], { type: 'text/plain' });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `encryption-test-${Date.now()}.txt`;
                          a.click();
                          URL.revokeObjectURL(url);
                        }}
                        style={{
                          width: '100%',
                          padding: '10px',
                          marginTop: '15px',
                          backgroundColor: '#16a085',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          fontSize: '14px',
                          cursor: 'pointer'
                        }}
                      >
                        💾 Export Results
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>
      
      {/* Password Confirmation Dialog */}
      {showPasswordDialog && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div 
            style={{
              backgroundColor: '#2c3e50',
              padding: '30px',
              borderRadius: '8px',
              maxWidth: '450px',
              width: '90%',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ color: 'white', marginTop: 0, marginBottom: '20px' }}>
              {pendingEncryptionAction === 'enable' ? '🔒 Enable Encryption' : '🔓 Disable Encryption'}
            </h3>
            
            <p style={{ color: '#bdc3c7', marginBottom: '20px' }}>
              {pendingEncryptionAction === 'enable'
                ? 'This will encrypt all data in the database. Please enter your family password to confirm.'
                : 'This will decrypt all data in the database. Please enter your family password to confirm.'}
            </p>
            
            {passwordDialogError && (
              <div style={{
                backgroundColor: '#e74c3c',
                color: 'white',
                padding: '12px',
                borderRadius: '6px',
                marginBottom: '12px',
                fontSize: '14px'
              }}>
                {passwordDialogError}
              </div>
            )}
            
            <input
              type="password"
              placeholder="Enter family password"
              value={passwordForEncryption}
              onChange={(e) => setPasswordForEncryption(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  document.getElementById('confirm-encryption-btn').click();
                }
              }}
              style={{
                width: '100%',
                padding: '12px',
                marginBottom: '20px',
                backgroundColor: '#34495e',
                border: '1px solid #7f8c8d',
                borderRadius: '4px',
                color: 'white',
                fontSize: '14px'
              }}
              autoFocus
            />
            
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                id="confirm-encryption-btn"
                onClick={async () => {
                  if (!passwordForEncryption) {
                    setPasswordDialogError('Please enter your family password');
                    return;
                  }
                  
                  // Verify the password matches the session password
                  const sessionPassword = getFamilyPassword();
                  if (passwordForEncryption !== sessionPassword) {
                    setPasswordDialogError('Incorrect password');
                    return;
                  }
                  
                  // Clear dialog error and close dialog
                  setPasswordDialogError('');
                  setShowPasswordDialog(false);
                  setLoading(true);
                  setError('');
                  setSuccess('');
                  setEncryptionProgress({ phase: 'loading', percent: 0, message: 'Initializing...' });
                  
                  try {
                    if (pendingEncryptionAction === 'enable') {
                      // Call enableEncryption with progress callback (password is already in session)
                      const result = await enableEncryption((progress) => {
                        setEncryptionProgress(progress);
                      });
                      
                      // Update local and session state with the new salt
                      setEncryptionEnabled(true);
                      setEncryptionSalt(result.salt);
                      await updateEncryptionStatus(true, result.salt);
                      setSuccess('Encryption enabled successfully');
                      
                      // Reload all data so UI shows decrypted values immediately
                      if (onDataReload) {
                        console.log('[AdminPanel] Reloading data after enabling encryption...');
                        await onDataReload();
                      }
                    } else {
                      // Call disableEncryption with progress callback (password is already in session)
                      await disableEncryption((progress) => {
                        setEncryptionProgress(progress);
                      });
                      
                      setEncryptionEnabled(false);
                      setEncryptionSalt(null);
                      await updateEncryptionStatus(false, null);
                      setSuccess('Encryption disabled successfully');
                      
                      // Reload all data so UI shows unencrypted values immediately
                      if (onDataReload) {
                        console.log('[AdminPanel] Reloading data after disabling encryption...');
                        await onDataReload();
                      }
                    }
                  } catch (err) {
                    setError(`Encryption operation failed: ${err.message}`);
                    console.error('Encryption toggle error:', err);
                  } finally {
                    setLoading(false);
                    setEncryptionProgress(null);
                    setPasswordForEncryption('');
                    setPendingEncryptionAction(null);
                    setTimeout(() => setSuccess(''), 3000);
                  }
                }}
                disabled={!passwordForEncryption}
                style={{
                  flex: 1,
                  padding: '12px',
                  backgroundColor: passwordForEncryption ? '#27ae60' : '#7f8c8d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '14px',
                  cursor: passwordForEncryption ? 'pointer' : 'not-allowed',
                  fontWeight: 'bold'
                }}
              >
                Confirm
              </button>
              
              <button
                onClick={() => {
                  setShowPasswordDialog(false);
                  setPasswordForEncryption('');
                  setPendingEncryptionAction(null);
                  setPasswordDialogError('');
                }}
                style={{
                  flex: 1,
                  padding: '12px',
                  backgroundColor: '#95a5a6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '14px',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPanel;
