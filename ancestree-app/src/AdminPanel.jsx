import React, { useState, useEffect } from 'react';
import { api } from './api';
import { useLanguage } from './locales/LanguageContext';
import { runEncryptionPerformanceTest, formatTestResults, getDatabaseFieldEstimates } from './encryptionPerformanceTest';
import { enableEncryption, disableEncryption } from './encryptionBatchOperations';
import { updateEncryptionStatus, getFamilyPassword, updatePassword, pauseKeyCheck, resumeKeyCheck } from './encryptionSession';
import { exportFamilyDataWithMetadata } from './exportUtils';
import TextInput from './components/TextInput';
import Button from './components/Button';
import DescriptionTextarea from './components/DescriptionTextarea';
import LanguagePicker from './components/LanguagePicker';

const AdminPanel = ({ isOpen, onClose, isAuthenticated, onAuthenticate, familyName, onDataReload }) => {
  const { translations: appConfig } = useLanguage();
  const [adminPassword, setAdminPassword] = useState('');
  const [newFamilyPassword, setNewFamilyPassword] = useState('');
  const [confirmFamilyPassword, setConfirmFamilyPassword] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [confirmAdminPassword, setConfirmAdminPassword] = useState('');
  const [purposePreview, setPurposePreview] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [currentFamilyPassword, setCurrentFamilyPassword] = useState('');
  const [activeTab, setActiveTab] = useState('familyParameters');
  const [encryptionEnabled, setEncryptionEnabled] = useState(false);
  const [encryptionSalt, setEncryptionSalt] = useState(null);
  const [nodeCreationLocked, setNodeCreationLocked] = useState(false);
  const [showStreetFields, setShowStreetFields] = useState(true);
  const [showPhoneField, setShowPhoneField] = useState(true);
  const [showEmailField, setShowEmailField] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [authError, setAuthError] = useState('');
  const [encryptionProgress, setEncryptionProgress] = useState(null);
  
  // Export state
  const [exportProgress, setExportProgress] = useState(null);
  const [exportLoading, setExportLoading] = useState(false);
  const [exportError, setExportError] = useState('');
  
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

  // Delete family state
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [deleteAdminPassword, setDeleteAdminPassword] = useState('');
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteError, setDeleteError] = useState('');

  // Completion settings state
  const [completionSettings, setCompletionSettings] = useState({
    showMissingRequired: false,
    requireName: true,
    requireSurname: true,
    requireMaidenName: true,
    requireBirthDate: true,
    requireStreetFields: true,
    requireCityZip: true,
    requireCountry: true,
    requirePhone: true,
    requireEmail: true
  });

  // Family emails state
  const [familyEmails, setFamilyEmails] = useState([]);
  const [loadingFamilyEmails, setLoadingFamilyEmails] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    // Fetch admin settings for display before authentication (purpose, admin email)
    const fetchPublicAdminSettings = async () => {
      try {
        const { encryptedApi } = await import('./encryptedApi');
        const adminSettings = await encryptedApi.getAdminSettings();
        setAdminEmail(adminSettings.admin_email || '');
        setPurposePreview(adminSettings.purpose || '');
      } catch (err) {
        console.error('Failed to fetch admin settings:', err);
        // Silently fail - settings might not be set yet
      }
    };

    // Always fetch admin settings when panel opens
    fetchPublicAdminSettings();

    // Fetch family emails (before authentication)
    const fetchFamilyEmails = async () => {
      try {
        setLoadingFamilyEmails(true);
        const { encryptedApi } = await import('./encryptedApi');
        const emails = await encryptedApi.getAllFamilyEmails();
        setFamilyEmails(emails);
      } catch (err) {
        console.error('Failed to fetch family emails:', err);
        // Silently fail - user might not have access yet
      } finally {
        setLoadingFamilyEmails(false);
      }
    };

    // Always fetch family emails when panel opens
    fetchFamilyEmails();

    // fetch protected settings if authenticated
    const fetchSettings = async () => {
      try {
        // Fetch family settings (encryption, field visibility, node creation lock)
        const settings = await api.getFamilySettings();
        setEncryptionEnabled(Boolean(settings.encryptionEnabled));
        setEncryptionSalt(settings.encryptionSalt || null);
        setNodeCreationLocked(Boolean(settings.nodeCreationLocked));
        setShowStreetFields(settings.showStreetFields !== undefined ? Boolean(settings.showStreetFields) : true);
        setShowPhoneField(settings.showPhoneField !== undefined ? Boolean(settings.showPhoneField) : true);
        setShowEmailField(settings.showEmailField !== undefined ? Boolean(settings.showEmailField) : true);

        // Fetch admin settings (purpose, display_name) from encrypted admin table
        // Use encryptedApi to handle automatic decryption
        const { encryptedApi } = await import('./encryptedApi');
        const adminSettings = await encryptedApi.getAdminSettings();
        setDisplayName(adminSettings.display_name || '');
        setPurposePreview(adminSettings.purpose || '');
        setAdminEmail(adminSettings.admin_email || '');

        // Fetch completion settings
        const completionData = await encryptedApi.getCompletionSettings();
        setCompletionSettings(completionData);
      } catch (err) {
        console.error('Failed to fetch settings:', err);
        // ignore if not authenticated
      }
    };

    if (isAuthenticated) {
      fetchSettings();
    }
  }, [isOpen, isAuthenticated]);

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
      setError(appConfig.ui.adminPanel.errors.passwordsDoNotMatch);
      setLoading(false);
      return;
    }

    if (newFamilyPassword.length < 6) {
      setError(appConfig.ui.adminPanel.errors.passwordTooShort);
      setLoading(false);
      return;
    }

    try {
      // If encryption is enabled, automatically handle re-encryption
      if (encryptionEnabled) {
        if (!currentFamilyPassword) {
          setError(appConfig.ui.adminPanel.errors.currentPasswordRequired);
          setLoading(false);
          return;
        }
        
        // Pause key availability checks during password change
        pauseKeyCheck();
        
        // Use the new streamlined password change with automatic re-encryption
        const { encryptedApi } = await import('./encryptedApi');
        
        const result = await encryptedApi.changePasswordWithReEncryption(
          currentFamilyPassword, 
          newFamilyPassword, 
          (progress) => {
            setEncryptionProgress(progress);
          }
        );
        
        // Update the password and encryption salt in session
        if (result.salt) {
          setEncryptionSalt(result.salt);
          await updatePassword(newFamilyPassword, result.salt);
        } else {
          await updatePassword(newFamilyPassword);
        }
        
        // Resume key availability checks
        resumeKeyCheck();
        
        setEncryptionProgress(null);
        setSuccess('Password changed and data re-encrypted successfully!');
        
        // Reload all data so UI shows decrypted values with new password
        if (onDataReload) {
          console.log('[AdminPanel] Reloading data after password change...');
          await onDataReload();
        }
      } else {
        // If encryption is not enabled, just change the password normally
        await api.changeFamilyPassword(newFamilyPassword);
        // Still update the password in session for future use
        await updatePassword(newFamilyPassword);
        setSuccess(appConfig.ui.adminPanel.success.familyPasswordUpdated);
      }
      
      setNewFamilyPassword('');
      setConfirmFamilyPassword('');
      setCurrentFamilyPassword('');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message);
      setEncryptionProgress(null);
      // Resume key checks even on error
      resumeKeyCheck();
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
      setError(appConfig.ui.adminPanel.errors.passwordsDoNotMatch);
      setLoading(false);
      return;
    }

    if (newAdminPassword.length < 6) {
      setError(appConfig.ui.adminPanel.errors.passwordTooShort);
      setLoading(false);
      return;
    }

    try {
      await api.changeAdminPassword(newAdminPassword);
      setSuccess(appConfig.ui.adminPanel.success.adminPasswordUpdated);
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
      setError(appConfig.ui.adminPanel.errors.testFailed + err.message);
      console.error('Performance test error:', err);
    } finally {
      setTestRunning(false);
    }
  };

  const handleDeleteFamily = async () => {
    if (deleteConfirmText !== 'LÖSCHEN') {
      setDeleteError('Bitte tippe LÖSCHEN zur Bestätigung');
      return;
    }

    if (!deleteAdminPassword) {
      setDeleteError('Admin-Passwort ist erforderlich');
      return;
    }

    setLoading(true);
    setDeleteError('');

    try {
      await api.deleteFamily(deleteAdminPassword);
      
      // Clear all local storage and logout
      api.logout();
      localStorage.clear();
      
      // Close the admin panel and redirect to login
      alert('Familie erfolgreich gelöscht. Du wirst zur Login-Seite weitergeleitet.');
      window.location.href = '/';
    } catch (err) {
      setDeleteError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>{`
        .contact-buttons-container {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        @media (min-width: 768px) {
          .contact-buttons-container {
            flex-direction: row;
          }
        }
      `}</style>
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
          backgroundColor: 'var(--login-bg)',
          borderRadius: '12px',
          padding: '30px',
          maxWidth: '800px',
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
          borderBottom: '2px solid var(--login-panel-bg)',
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
              color: 'var(--login-text-primary)',
              fontSize: '28px',
              cursor: 'pointer',
              padding: '0',
              lineHeight: '1'
            }}
          >
            {appConfig.ui.adminPanelCommon.closeButton}
          </button>
        </div>
        
        {/* Language Picker - shown before authentication */}
        {!isAuthenticated && (
          <div style={{ 
            display: 'flex', 
            justifyContent: 'flex-end', 
            marginBottom: '16px' 
          }}>
            <LanguagePicker />
          </div>
        )}
        
        {/* Authentication / Preview Section */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{
            backgroundColor: 'var(--login-panel-bg)',
            padding: '16px',
            borderRadius: '8px',
            marginBottom: '12px'
          }}>
            <h3 style={{ marginTop: 0, fontSize: '16px', marginBottom: '8px' }}>
              {appConfig.ui.adminPanel.familyParameters.purposeLabel}
            </h3>
            <div style={{ fontSize: '13px', color: 'var(--login-text-secondary)', marginBottom: '8px' }}>
              {purposePreview ? (
                purposePreview.split('\n\n').map((paragraph, idx) => (
                  <p key={idx} style={{ marginTop: idx === 0 ? 0 : '1em', marginBottom: 0 }}>
                    {paragraph.split('\n').map((line, lineIdx) => (
                      <React.Fragment key={lineIdx}>
                        {lineIdx > 0 && <br />}
                        {line}
                      </React.Fragment>
                    ))}
                  </p>
                ))
              ) : (
                appConfig.ui.adminPanelCommon.noDescription
              )}
            </div>
          </div>

          {!isAuthenticated ? (
            <>
              {/* Contact Section - shown before authentication */}
              {(adminEmail || familyEmails.length > 0) && (
                <div style={{
                  backgroundColor: 'var(--login-panel-bg)',
                  padding: '16px',
                  borderRadius: '8px',
                  marginBottom: '12px'
                }}>
                  <div className="contact-buttons-container">
                    {/* Contact Administrator */}
                    {adminEmail && (
                      <div className="contact-button-item" style={{
                        textAlign: 'center',
                        flex: '1',
                        minWidth: '250px'
                      }}>
                        <p style={{ 
                          fontSize: '13px', 
                          color: 'var(--login-text-secondary)', 
                          marginBottom: '10px',
                          marginTop: 0
                        }}>
                          {appConfig.ui.adminPanel.contactAdmin.message}
                        </p>
                        <a
                          href={`mailto:${adminEmail}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            display: 'inline-block',
                            width: '100%',
                            maxWidth: '100%',
                            padding: '10px 20px',
                            backgroundColor: '#3498db',
                            color: 'white',
                            textDecoration: 'none',
                            borderRadius: '6px',
                            fontSize: '14px',
                            fontWeight: '600',
                            transition: 'background-color 0.2s',
                            boxSizing: 'border-box'
                          }}
                          onMouseEnter={(e) => e.target.style.backgroundColor = '#2980b9'}
                          onMouseLeave={(e) => e.target.style.backgroundColor = '#3498db'}
                        >
                          📧 {adminEmail}
                        </a>
                      </div>
                    )}

                    {/* Contact Family */}
                    {familyEmails.length > 0 && (
                      <div className="contact-button-item" style={{
                        textAlign: 'center',
                        flex: '1',
                        minWidth: '250px'
                      }}>
                        <p style={{ 
                          fontSize: '13px', 
                          color: 'var(--login-text-secondary)', 
                          marginBottom: '10px',
                          marginTop: 0
                        }}>
                          {appConfig.ui.adminPanel.contactFamily.message}
                        </p>
                        <a
                          href={`mailto:${familyEmails.join(',')}?subject=${encodeURIComponent(appConfig.ui.adminPanel.contactFamily.subject)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            display: 'inline-block',
                            width: '100%',
                            maxWidth: '100%',
                            padding: '10px 20px',
                            backgroundColor: '#27ae60',
                            color: 'white',
                            textDecoration: 'none',
                            borderRadius: '6px',
                            fontSize: '14px',
                            fontWeight: '600',
                            transition: 'background-color 0.2s',
                            boxSizing: 'border-box',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}
                          onMouseEnter={(e) => e.target.style.backgroundColor = '#229954'}
                          onMouseLeave={(e) => e.target.style.backgroundColor = '#27ae60'}
                          title={familyEmails.join(', ')}
                        >
                          📧 {appConfig.ui.adminPanel.contactFamily.button}
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <form onSubmit={handleAdminLogin}>
              <div style={{
                backgroundColor: 'var(--login-panel-bg)',
                padding: '18px',
                borderRadius: '8px'
              }}>
                <h3 style={{ marginTop: 0, fontSize: '18px', marginBottom: '10px' }}>
                  🔐 {appConfig.ui.adminPanel.title}
                </h3>
                <p style={{ fontSize: '14px', color: 'var(--login-text-secondary)', marginBottom: '10px' }}>
                  {appConfig.ui.adminPanel.authPrompt}
                  <br />
                  <small style={{ color: 'var(--login-text-muted)' }}>{appConfig.ui.adminPanel.defaultAdminNote}</small>
                </p>

                <TextInput
                  type="password"
                  placeholder={appConfig.ui.adminPanel.authPrompt}
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
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

                <Button
                  type="submit"
                  disabled={loading || !adminPassword}
                  variant="success"
                  size="large"
                  className="w-full"
                >
                  {loading ? appConfig.ui.adminPanelCommon.authenticating : appConfig.ui.adminPanelCommon.authenticateButton}
                </Button>
              </div>
            </form>
            </>
          ) : null}
        </div>

        {/* If authenticated show tabs */}
        {isAuthenticated ? (
          <div style={{ display: 'flex', gap: '16px' }}>
            {/* Side menu */}
            <div style={{ width: '192px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button onClick={() => setActiveTab('familyParameters')} style={{ padding: '10px', borderRadius: '6px', background: activeTab === 'familyParameters' ? '#3b5770' : 'transparent', color: 'white', border: '1px solid #34495e', textAlign: 'left' }}>{appConfig.ui.adminPanel.menu.familyParameters}</button>
              <button onClick={() => setActiveTab('passwords')} style={{ padding: '10px', borderRadius: '6px', background: activeTab === 'passwords' ? '#3b5770' : 'transparent', color: 'white', border: '1px solid #34495e', textAlign: 'left' }}>{appConfig.ui.adminPanel.menu.passwords}</button>
              <button onClick={() => setActiveTab('security')} style={{ padding: '10px', borderRadius: '6px', background: activeTab === 'security' ? '#3b5770' : 'transparent', color: 'white', border: '1px solid #34495e', textAlign: 'left' }}>{appConfig.ui.adminPanel.menu.security}</button>
              <button onClick={() => setActiveTab('visibleFields')} style={{ padding: '10px', borderRadius: '6px', background: activeTab === 'visibleFields' ? '#3b5770' : 'transparent', color: 'white', border: '1px solid #34495e', textAlign: 'left' }}>{appConfig.ui.adminPanel.menu.visibleFields}</button>
              <button onClick={() => setActiveTab('completion')} style={{ padding: '10px', borderRadius: '6px', background: activeTab === 'completion' ? '#3b5770' : 'transparent', color: 'white', border: '1px solid #34495e', textAlign: 'left' }}>{appConfig.ui.adminPanel.menu.completion}</button>
              <button onClick={() => setActiveTab('dataExport')} style={{ padding: '10px', borderRadius: '6px', background: activeTab === 'dataExport' ? '#3b5770' : 'transparent', color: 'white', border: '1px solid #34495e', textAlign: 'left' }}>{appConfig.ui.adminPanel.menu.dataExport}</button>
              <button onClick={() => setActiveTab('test')} style={{ padding: '10px', borderRadius: '6px', background: activeTab === 'test' ? '#3b5770' : 'transparent', color: 'white', border: '1px solid #34495e', textAlign: 'left' }}>🧪 Test</button>
              <button onClick={() => setActiveTab('dangerZone')} style={{ padding: '10px', borderRadius: '6px', background: activeTab === 'dangerZone' ? '#c0392b' : 'transparent', color: activeTab === 'dangerZone' ? 'white' : '#e74c3c', border: '1px solid #e74c3c', textAlign: 'left', fontWeight: '600' }}>{appConfig.ui.adminPanel.menu.dangerZone}</button>
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
                  <TextInput
                    label={appConfig.ui.adminPanel.familyParameters.displayNameLabel}
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                  />
                  
                  <TextInput
                    label={appConfig.ui.adminPanel.familyParameters.adminEmailLabel}
                    type="email"
                    value={adminEmail}
                    onChange={(e) => {
                      setAdminEmail(e.target.value);
                      setEmailError('');
                    }}
                    error={emailError}
                    helperText={emailError || appConfig.ui.adminPanel.familyParameters.adminEmailHint}
                  />
                  
                  <label style={{ display: 'block', marginBottom: '6px', color: 'white', fontWeight: 'bold', fontSize: '14px' }}>
                    {appConfig.ui.adminPanel.familyParameters.purposeLabel}
                  </label>
                  <DescriptionTextarea
                    value={purposePreview}
                    onChange={(e) => setPurposePreview(e.target.value)}
                    placeholder={appConfig.ui.adminPanel.familyParameters.purposePlaceholder}
                    maxLength={3000}
                    showButtons={false}
                  />
                  <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                    <Button onClick={async () => {
                      // Validate email format
                      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                      if (adminEmail && !emailRegex.test(adminEmail)) {
                        setEmailError(appConfig.ui.login.validation.invalidEmail);
                        return;
                      }
                      
                      setLoading(true); 
                      setError(''); 
                      setSuccess(''); 
                      setEmailError('');
                      try { 
                        const { encryptedApi } = await import('./encryptedApi');
                        await encryptedApi.updateDisplayName(displayName);
                        if (adminEmail) {
                          await encryptedApi.updateAdminEmail(adminEmail);
                        }
                        await encryptedApi.updatePurpose(purposePreview); 
                        setSuccess('Family parameters updated'); 
                      } catch (err) { 
                        setError(err.message); 
                      } finally { 
                        setLoading(false); 
                        setTimeout(() => setSuccess(''), 3000); 
                      } 
                    }} 
                    disabled={loading}
                    variant="primary"
                    size="medium"
                  >
                    {appConfig.ui.adminPanel.familyParameters.saveButton}
                  </Button>
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
                      <TextInput
                        label={appConfig.ui.adminPanelCommon.currentFamilyPasswordLabel}
                        type="password"
                        placeholder={appConfig.ui.adminPanel.passwords.currentFamilyPasswordPlaceholder}
                        value={currentFamilyPassword}
                        onChange={(e) => setCurrentFamilyPassword(e.target.value)}
                        disabled={loading || encryptionProgress !== null}
                      />
                    )}
                    <TextInput
                      type="password"
                      placeholder={appConfig.ui.adminPanel.passwords.newFamilyPasswordPlaceholder}
                      value={newFamilyPassword}
                      onChange={(e) => setNewFamilyPassword(e.target.value)}
                      disabled={loading || encryptionProgress !== null}
                    />
                    <TextInput
                      type="password"
                      placeholder={appConfig.ui.adminPanel.passwords.confirmFamilyPasswordPlaceholder}
                      value={confirmFamilyPassword}
                      onChange={(e) => setConfirmFamilyPassword(e.target.value)}
                      disabled={loading || encryptionProgress !== null}
                    />
                    <Button
                      type="submit"
                      disabled={loading || encryptionProgress !== null || !newFamilyPassword || !confirmFamilyPassword}
                      variant="primary"
                      size="medium"
                    >
                      {appConfig.ui.adminPanel.passwords.saveButton}
                    </Button>
                  </form>

                  <form onSubmit={handleChangeAdminPassword} style={{ marginTop: '12px', backgroundColor: '#34495e', padding: '20px', borderRadius: '8px' }}>
                    <h3 style={{ marginTop: 0 }}>{appConfig.ui.adminPanel.passwords.title} - Admin</h3>
                    <TextInput
                      label={appConfig.ui.adminPanel.passwords.adminPasswordLabel}
                      type="password"
                      placeholder={appConfig.ui.adminPanel.passwords.newAdminPasswordPlaceholder}
                      value={newAdminPassword}
                      onChange={(e) => setNewAdminPassword(e.target.value)}
                    />
                    <TextInput
                      type="password"
                      placeholder={appConfig.ui.adminPanel.passwords.confirmAdminPasswordPlaceholder}
                      value={confirmAdminPassword}
                      onChange={(e) => setConfirmAdminPassword(e.target.value)}
                    />
                    <Button
                      type="submit"
                      disabled={loading || !newAdminPassword || !confirmAdminPassword}
                      variant="primary"
                      size="medium"
                    >
                      {appConfig.ui.adminPanel.passwords.saveButton}
                    </Button>
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

                  {/* Node Creation Lock Toggle */}
                  <div style={{ marginTop: '20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <label style={{ color: 'white', flex: 1 }}>
                      {appConfig.ui.adminPanel.security.nodeCreationLockLabel}
                      <div style={{ fontSize: '12px', color: '#bdc3c7', marginTop: '4px' }}>
                        {appConfig.ui.adminPanel.security.nodeCreationLockHint}
                      </div>
                    </label>
                    <button
                      disabled={loading}
                      onClick={async () => {
                        setLoading(true);
                        setError('');
                        try {
                          await api.updateNodeCreationLock(!nodeCreationLocked);
                          setNodeCreationLocked(!nodeCreationLocked);
                          setSuccess(`Knotenerstellung ${!nodeCreationLocked ? 'gesperrt' : 'freigegeben'}`);
                          setTimeout(() => setSuccess(''), 3000);
                        } catch (err) {
                          setError(err.message);
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
                        backgroundColor: nodeCreationLocked ? '#e74c3c' : '#7f8c8d',
                        transition: 'background-color 0.3s ease',
                        opacity: loading ? 0.6 : 1,
                        padding: 0
                      }}
                    >
                      <div style={{
                        position: 'absolute',
                        top: '3px',
                        left: nodeCreationLocked ? '33px' : '3px',
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

              {activeTab === 'visibleFields' && (
                <div style={{ backgroundColor: '#34495e', padding: '20px', borderRadius: '8px' }}>
                  <h3 style={{ marginTop: 0 }}>{appConfig.ui.adminPanel.visibleFields.title}</h3>
                  <p style={{ color: '#bdc3c7', fontSize: '14px', marginBottom: '20px' }}>
                    {appConfig.ui.adminPanel.visibleFields.description}
                  </p>
                  
                  {/* Street Fields Visibility Toggle */}
                  <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <label style={{ color: 'white', flex: 1 }}>
                      {appConfig.ui.adminPanel.visibleFields.streetFieldsLabel}
                      <div style={{ fontSize: '12px', color: '#bdc3c7', marginTop: '4px' }}>
                        {appConfig.ui.adminPanel.visibleFields.streetFieldsHint}
                      </div>
                    </label>
                    <button
                      disabled={loading}
                      onClick={async () => {
                        const newValue = !showStreetFields;
                        setLoading(true);
                        setError('');
                        setSuccess('');
                        try {
                          await api.updateStreetFieldsVisibility(newValue);
                          setShowStreetFields(newValue);
                          setSuccess(newValue ? appConfig.ui.adminPanel.visibleFields.showSuccess : appConfig.ui.adminPanel.visibleFields.hideSuccess);
                          setTimeout(() => setSuccess(''), 3000);
                          // Trigger data reload to update UI
                          if (onDataReload) {
                            onDataReload();
                          }
                        } catch (err) {
                          setError(`${appConfig.ui.adminPanel.visibleFields.updateError}: ${err.message}`);
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
                        backgroundColor: showStreetFields ? '#27ae60' : '#7f8c8d',
                        transition: 'background-color 0.3s ease',
                        opacity: loading ? 0.6 : 1,
                        padding: 0
                      }}
                    >
                      <div style={{
                        position: 'absolute',
                        top: '3px',
                        left: showStreetFields ? '33px' : '3px',
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        backgroundColor: 'white',
                        transition: 'left 0.3s ease',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                      }} />
                    </button>
                  </div>

                  {/* Phone Field Visibility Toggle */}
                  <div style={{ marginTop: '20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <label style={{ color: 'white', flex: 1 }}>
                      {appConfig.ui.adminPanel.visibleFields.phoneFieldLabel}
                      <div style={{ fontSize: '12px', color: '#bdc3c7', marginTop: '4px' }}>
                        {appConfig.ui.adminPanel.visibleFields.phoneFieldHint}
                      </div>
                    </label>
                    <button
                      disabled={loading}
                      onClick={async () => {
                        const newValue = !showPhoneField;
                        setLoading(true);
                        setError('');
                        setSuccess('');
                        try {
                          await api.updatePhoneFieldVisibility(newValue);
                          setShowPhoneField(newValue);
                          setSuccess(newValue ? appConfig.ui.adminPanel.visibleFields.phoneShowSuccess : appConfig.ui.adminPanel.visibleFields.phoneHideSuccess);
                          setTimeout(() => setSuccess(''), 3000);
                          if (onDataReload) {
                            onDataReload();
                          }
                        } catch (err) {
                          setError(`${appConfig.ui.adminPanel.visibleFields.updateError}: ${err.message}`);
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
                        backgroundColor: showPhoneField ? '#27ae60' : '#7f8c8d',
                        transition: 'background-color 0.3s ease',
                        opacity: loading ? 0.6 : 1,
                        padding: 0
                      }}
                    >
                      <div style={{
                        position: 'absolute',
                        top: '3px',
                        left: showPhoneField ? '33px' : '3px',
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        backgroundColor: 'white',
                        transition: 'left 0.3s ease',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                      }} />
                    </button>
                  </div>

                  {/* Email Field Visibility Toggle */}
                  <div style={{ marginTop: '20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <label style={{ color: 'white', flex: 1 }}>
                      {appConfig.ui.adminPanel.visibleFields.emailFieldLabel}
                      <div style={{ fontSize: '12px', color: '#bdc3c7', marginTop: '4px' }}>
                        {appConfig.ui.adminPanel.visibleFields.emailFieldHint}
                      </div>
                    </label>
                    <button
                      disabled={loading}
                      onClick={async () => {
                        const newValue = !showEmailField;
                        setLoading(true);
                        setError('');
                        setSuccess('');
                        try {
                          await api.updateEmailFieldVisibility(newValue);
                          setShowEmailField(newValue);
                          setSuccess(newValue ? appConfig.ui.adminPanel.visibleFields.emailShowSuccess : appConfig.ui.adminPanel.visibleFields.emailHideSuccess);
                          setTimeout(() => setSuccess(''), 3000);
                          if (onDataReload) {
                            onDataReload();
                          }
                        } catch (err) {
                          setError(`${appConfig.ui.adminPanel.visibleFields.updateError}: ${err.message}`);
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
                        backgroundColor: showEmailField ? '#27ae60' : '#7f8c8d',
                        transition: 'background-color 0.3s ease',
                        opacity: loading ? 0.6 : 1,
                        padding: 0
                      }}
                    >
                      <div style={{
                        position: 'absolute',
                        top: '3px',
                        left: showEmailField ? '33px' : '3px',
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

              {activeTab === 'dataExport' && (
                <div style={{ backgroundColor: '#34495e', padding: '20px', borderRadius: '8px' }}>
                  <h3 style={{ marginTop: 0 }}>{appConfig.ui.adminPanel.dataExport.title}</h3>
                  <p style={{ color: '#bdc3c7', fontSize: '14px', marginBottom: '20px' }}>
                    {appConfig.ui.adminPanel.dataExport.description}
                  </p>

                  {/* What will be exported */}
                  <div style={{ backgroundColor: '#2c3e50', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
                    <h4 style={{ marginTop: 0, marginBottom: '12px', fontSize: '16px' }}>
                      {appConfig.ui.adminPanel.dataExport.whatWillBeExported}
                    </h4>
                    <ul style={{ margin: 0, paddingLeft: '20px', color: '#bdc3c7', fontSize: '14px' }}>
                      <li style={{ marginBottom: '8px' }}>{appConfig.ui.adminPanel.dataExport.exportItems.personalData}</li>
                      <li style={{ marginBottom: '8px' }}>{appConfig.ui.adminPanel.dataExport.exportItems.images}</li>
                      <li style={{ marginBottom: '8px' }}>{appConfig.ui.adminPanel.dataExport.exportItems.imageMetadata}</li>
                    </ul>
                  </div>

                  {/* Hints */}
                  <div style={{ backgroundColor: '#2c3e50', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
                    <p style={{ margin: '0 0 8px 0', color: '#f39c12', fontSize: '14px' }}>
                      {appConfig.ui.adminPanel.dataExport.hints.decrypted}
                    </p>
                    <p style={{ margin: 0, color: '#e67e22', fontSize: '14px' }}>
                      {appConfig.ui.adminPanel.dataExport.hints.keepSafe}
                    </p>
                  </div>

                  {/* Export error */}
                  {exportError && (
                    <div style={{
                      backgroundColor: '#e74c3c',
                      color: 'white',
                      padding: '12px',
                      borderRadius: '6px',
                      marginBottom: '15px',
                      fontSize: '14px'
                    }}>
                      {exportError}
                    </div>
                  )}

                  {/* Progress bar */}
                  {exportProgress && (
                    <div style={{ marginBottom: '20px' }}>
                      <div style={{
                        backgroundColor: '#2c3e50',
                        borderRadius: '8px',
                        padding: '15px',
                        marginBottom: '10px'
                      }}>
                        <div style={{
                          fontSize: '14px',
                          color: '#ecf0f1',
                          marginBottom: '10px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}>
                          <span>{exportProgress.message}</span>
                          <span style={{ fontWeight: 'bold' }}>{Math.round(exportProgress.percent)}%</span>
                        </div>
                        <div style={{
                          width: '100%',
                          height: '8px',
                          backgroundColor: '#34495e',
                          borderRadius: '4px',
                          overflow: 'hidden'
                        }}>
                          <div style={{
                            width: `${exportProgress.percent}%`,
                            height: '100%',
                            backgroundColor: '#3498db',
                            transition: 'width 0.3s ease',
                            borderRadius: '4px'
                          }} />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Download button */}
                  <button
                    onClick={async () => {
                      setExportLoading(true);
                      setExportError('');
                      setExportProgress({ percent: 0, message: 'Starte Export...' });
                      
                      try {
                        await exportFamilyDataWithMetadata((percent, message) => {
                          setExportProgress({ percent, message });
                        }, familyName);
                        
                        // Clear progress after a short delay to show completion
                        setTimeout(() => {
                          setExportProgress(null);
                        }, 2000);
                      } catch (err) {
                        console.error('Export failed:', err);
                        setExportError(appConfig.ui.adminPanel.dataExport.errors.downloadFailed + err.message);
                        setExportProgress(null);
                      } finally {
                        setExportLoading(false);
                      }
                    }}
                    disabled={exportLoading}
                    style={{
                      width: '100%',
                      padding: '15px',
                      backgroundColor: exportLoading ? '#95a5a6' : '#27ae60',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '16px',
                      fontWeight: 'bold',
                      cursor: exportLoading ? 'not-allowed' : 'pointer',
                      transition: 'background-color 0.2s'
                    }}
                  >
                    {exportLoading 
                      ? appConfig.ui.adminPanel.dataExport.downloadingButton
                      : appConfig.ui.adminPanel.dataExport.downloadButton
                    }
                  </button>
                </div>
              )}

              {activeTab === 'completion' && (
                <div style={{ backgroundColor: '#34495e', padding: '20px', borderRadius: '8px' }}>
                  <h3 style={{ marginTop: 0 }}>{appConfig.ui.adminPanel.completion.title}</h3>
                  <p style={{ color: '#bdc3c7', fontSize: '14px', marginBottom: '20px' }}>
                    {appConfig.ui.adminPanel.completion.description}
                  </p>

                  {/* Main toggle for showing incomplete nodes */}
                  <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <label style={{ color: 'white', flex: 1 }}>
                      {appConfig.ui.adminPanel.completion.mainToggleLabel}
                      <div style={{ fontSize: '12px', color: '#bdc3c7', marginTop: '4px' }}>
                        {appConfig.ui.adminPanel.completion.mainToggleHint}
                      </div>
                    </label>
                    <button
                      disabled={loading}
                      onClick={async () => {
                        const newValue = !completionSettings.showMissingRequired;
                        setLoading(true);
                        setError('');
                        try {
                          const { encryptedApi } = await import('./encryptedApi');
                          const updatedSettings = {
                            ...completionSettings,
                            showMissingRequired: newValue
                          };
                          await encryptedApi.updateCompletionSettings(updatedSettings);
                          setCompletionSettings(updatedSettings);
                          setSuccess(appConfig.ui.adminPanel.completion.success);
                          setTimeout(() => setSuccess(''), 3000);
                          // Trigger data reload to update node displays
                          if (onDataReload) onDataReload();
                        } catch (err) {
                          setError(err.message || appConfig.ui.adminPanel.completion.settingsUpdateError);
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
                        backgroundColor: completionSettings.showMissingRequired ? '#27ae60' : '#7f8c8d',
                        transition: 'background-color 0.3s ease',
                        opacity: loading ? 0.6 : 1,
                        padding: 0
                      }}
                    >
                      <div style={{
                        position: 'absolute',
                        top: '3px',
                        left: completionSettings.showMissingRequired ? '33px' : '3px',
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        backgroundColor: 'white',
                        transition: 'left 0.3s ease',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                      }} />
                    </button>
                  </div>

                  {/* Required fields section */}
                  <div style={{ backgroundColor: '#2c3e50', padding: '15px', borderRadius: '8px', marginTop: '20px' }}>
                    <h4 style={{ color: 'white', marginTop: 0, marginBottom: '15px' }}>{appConfig.ui.adminPanel.completion.requiredFieldsTitle}</h4>
                    <p style={{ color: '#bdc3c7', fontSize: '14px', marginBottom: '15px' }}>
                      {appConfig.ui.adminPanel.completion.requiredFieldsDescription}
                    </p>

                    {/* Name */}
                    <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <label style={{ color: 'white', flex: 1 }}>
                        {appConfig.ui.adminPanel.completion.fields.name.label}
                        <div style={{ fontSize: '12px', color: '#bdc3c7', marginTop: '4px' }}>
                          {appConfig.ui.adminPanel.completion.fields.name.hint}
                        </div>
                      </label>
                      <button
                        disabled={loading}
                        onClick={async () => {
                          const newValue = !completionSettings.requireName;
                          setLoading(true);
                          try {
                            const { encryptedApi } = await import('./encryptedApi');
                            const updatedSettings = { ...completionSettings, requireName: newValue };
                            await encryptedApi.updateCompletionSettings(updatedSettings);
                            setCompletionSettings(updatedSettings);
                            if (onDataReload) onDataReload();
                          } catch (err) {
                            setError(err.message || 'Failed to update setting');
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
                          backgroundColor: completionSettings.requireName ? '#27ae60' : '#7f8c8d',
                          transition: 'background-color 0.3s ease',
                          opacity: loading ? 0.6 : 1,
                          padding: 0
                        }}
                      >
                        <div style={{
                          position: 'absolute',
                          top: '3px',
                          left: completionSettings.requireName ? '33px' : '3px',
                          width: '24px',
                          height: '24px',
                          borderRadius: '50%',
                          backgroundColor: 'white',
                          transition: 'left 0.3s ease',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                        }} />
                      </button>
                    </div>

                    {/* Surname */}
                    <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <label style={{ color: 'white', flex: 1 }}>
                        {appConfig.ui.adminPanel.completion.fields.surname.label}
                        <div style={{ fontSize: '12px', color: '#bdc3c7', marginTop: '4px' }}>
                          {appConfig.ui.adminPanel.completion.fields.surname.hint}
                        </div>
                      </label>
                      <button
                        disabled={loading}
                        onClick={async () => {
                          const newValue = !completionSettings.requireSurname;
                          setLoading(true);
                          try {
                            const { encryptedApi } = await import('./encryptedApi');
                            const updatedSettings = { ...completionSettings, requireSurname: newValue };
                            await encryptedApi.updateCompletionSettings(updatedSettings);
                            setCompletionSettings(updatedSettings);
                            if (onDataReload) onDataReload();
                          } catch (err) {
                            setError(err.message || 'Failed to update setting');
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
                          backgroundColor: completionSettings.requireSurname ? '#27ae60' : '#7f8c8d',
                          transition: 'background-color 0.3s ease',
                          opacity: loading ? 0.6 : 1,
                          padding: 0
                        }}
                      >
                        <div style={{
                          position: 'absolute',
                          top: '3px',
                          left: completionSettings.requireSurname ? '33px' : '3px',
                          width: '24px',
                          height: '24px',
                          borderRadius: '50%',
                          backgroundColor: 'white',
                          transition: 'left 0.3s ease',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                        }} />
                      </button>
                    </div>

                    {/* Maiden Name */}
                    <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <label style={{ color: 'white', flex: 1 }}>
                        {appConfig.ui.adminPanel.completion.fields.maidenName.label}
                        <div style={{ fontSize: '12px', color: '#bdc3c7', marginTop: '4px' }}>
                          {appConfig.ui.adminPanel.completion.fields.maidenName.hint}
                        </div>
                      </label>
                      <button
                        disabled={loading}
                        onClick={async () => {
                          const newValue = !completionSettings.requireMaidenName;
                          setLoading(true);
                          try {
                            const { encryptedApi } = await import('./encryptedApi');
                            const updatedSettings = { ...completionSettings, requireMaidenName: newValue };
                            await encryptedApi.updateCompletionSettings(updatedSettings);
                            setCompletionSettings(updatedSettings);
                            if (onDataReload) onDataReload();
                          } catch (err) {
                            setError(err.message || 'Failed to update setting');
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
                          backgroundColor: completionSettings.requireMaidenName ? '#27ae60' : '#7f8c8d',
                          transition: 'background-color 0.3s ease',
                          opacity: loading ? 0.6 : 1,
                          padding: 0
                        }}
                      >
                        <div style={{
                          position: 'absolute',
                          top: '3px',
                          left: completionSettings.requireMaidenName ? '33px' : '3px',
                          width: '24px',
                          height: '24px',
                          borderRadius: '50%',
                          backgroundColor: 'white',
                          transition: 'left 0.3s ease',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                        }} />
                      </button>
                    </div>

                    {/* Birth Date */}
                    <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <label style={{ color: 'white', flex: 1 }}>
                        {appConfig.ui.adminPanel.completion.fields.birthDate.label}
                        <div style={{ fontSize: '12px', color: '#bdc3c7', marginTop: '4px' }}>
                          {appConfig.ui.adminPanel.completion.fields.birthDate.hint}
                        </div>
                      </label>
                      <button
                        disabled={loading}
                        onClick={async () => {
                          const newValue = !completionSettings.requireBirthDate;
                          setLoading(true);
                          try {
                            const { encryptedApi } = await import('./encryptedApi');
                            const updatedSettings = { ...completionSettings, requireBirthDate: newValue };
                            await encryptedApi.updateCompletionSettings(updatedSettings);
                            setCompletionSettings(updatedSettings);
                            if (onDataReload) onDataReload();
                          } catch (err) {
                            setError(err.message || 'Failed to update setting');
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
                          backgroundColor: completionSettings.requireBirthDate ? '#27ae60' : '#7f8c8d',
                          transition: 'background-color 0.3s ease',
                          opacity: loading ? 0.6 : 1,
                          padding: 0
                        }}
                      >
                        <div style={{
                          position: 'absolute',
                          top: '3px',
                          left: completionSettings.requireBirthDate ? '33px' : '3px',
                          width: '24px',
                          height: '24px',
                          borderRadius: '50%',
                          backgroundColor: 'white',
                          transition: 'left 0.3s ease',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                        }} />
                      </button>
                    </div>

                    {/* Street & House Number */}
                    <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <label style={{ color: 'white', flex: 1 }}>
                        {appConfig.ui.adminPanel.completion.fields.streetFields.label}
                        <div style={{ fontSize: '12px', color: '#bdc3c7', marginTop: '4px' }}>
                          {appConfig.ui.adminPanel.completion.fields.streetFields.hint}
                        </div>
                      </label>
                      <button
                        disabled={loading}
                        onClick={async () => {
                          const newValue = !completionSettings.requireStreetFields;
                          setLoading(true);
                          try {
                            const { encryptedApi } = await import('./encryptedApi');
                            const updatedSettings = { ...completionSettings, requireStreetFields: newValue };
                            await encryptedApi.updateCompletionSettings(updatedSettings);
                            setCompletionSettings(updatedSettings);
                            if (onDataReload) onDataReload();
                          } catch (err) {
                            setError(err.message || 'Failed to update setting');
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
                          backgroundColor: completionSettings.requireStreetFields ? '#27ae60' : '#7f8c8d',
                          transition: 'background-color 0.3s ease',
                          opacity: loading ? 0.6 : 1,
                          padding: 0
                        }}
                      >
                        <div style={{
                          position: 'absolute',
                          top: '3px',
                          left: completionSettings.requireStreetFields ? '33px' : '3px',
                          width: '24px',
                          height: '24px',
                          borderRadius: '50%',
                          backgroundColor: 'white',
                          transition: 'left 0.3s ease',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                        }} />
                      </button>
                    </div>

                    {/* City & ZIP */}
                    <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <label style={{ color: 'white', flex: 1 }}>
                        {appConfig.ui.adminPanel.completion.fields.cityZip.label}
                        <div style={{ fontSize: '12px', color: '#bdc3c7', marginTop: '4px' }}>
                          {appConfig.ui.adminPanel.completion.fields.cityZip.hint}
                        </div>
                      </label>
                      <button
                        disabled={loading}
                        onClick={async () => {
                          const newValue = !completionSettings.requireCityZip;
                          setLoading(true);
                          try {
                            const { encryptedApi } = await import('./encryptedApi');
                            const updatedSettings = { ...completionSettings, requireCityZip: newValue };
                            await encryptedApi.updateCompletionSettings(updatedSettings);
                            setCompletionSettings(updatedSettings);
                            if (onDataReload) onDataReload();
                          } catch (err) {
                            setError(err.message || 'Failed to update setting');
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
                          backgroundColor: completionSettings.requireCityZip ? '#27ae60' : '#7f8c8d',
                          transition: 'background-color 0.3s ease',
                          opacity: loading ? 0.6 : 1,
                          padding: 0
                        }}
                      >
                        <div style={{
                          position: 'absolute',
                          top: '3px',
                          left: completionSettings.requireCityZip ? '33px' : '3px',
                          width: '24px',
                          height: '24px',
                          borderRadius: '50%',
                          backgroundColor: 'white',
                          transition: 'left 0.3s ease',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                        }} />
                      </button>
                    </div>

                    {/* Country */}
                    <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <label style={{ color: 'white', flex: 1 }}>
                        {appConfig.ui.adminPanel.completion.fields.country.label}
                        <div style={{ fontSize: '12px', color: '#bdc3c7', marginTop: '4px' }}>
                          {appConfig.ui.adminPanel.completion.fields.country.hint}
                        </div>
                      </label>
                      <button
                        disabled={loading}
                        onClick={async () => {
                          const newValue = !completionSettings.requireCountry;
                          setLoading(true);
                          try {
                            const { encryptedApi } = await import('./encryptedApi');
                            const updatedSettings = { ...completionSettings, requireCountry: newValue };
                            await encryptedApi.updateCompletionSettings(updatedSettings);
                            setCompletionSettings(updatedSettings);
                            if (onDataReload) onDataReload();
                          } catch (err) {
                            setError(err.message || 'Failed to update setting');
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
                          backgroundColor: completionSettings.requireCountry ? '#27ae60' : '#7f8c8d',
                          transition: 'background-color 0.3s ease',
                          opacity: loading ? 0.6 : 1,
                          padding: 0
                        }}
                      >
                        <div style={{
                          position: 'absolute',
                          top: '3px',
                          left: completionSettings.requireCountry ? '33px' : '3px',
                          width: '24px',
                          height: '24px',
                          borderRadius: '50%',
                          backgroundColor: 'white',
                          transition: 'left 0.3s ease',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                        }} />
                      </button>
                    </div>

                    {/* Phone */}
                    <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <label style={{ color: 'white', flex: 1 }}>
                        {appConfig.ui.adminPanel.completion.fields.phone.label}
                        <div style={{ fontSize: '12px', color: '#bdc3c7', marginTop: '4px' }}>
                          {appConfig.ui.adminPanel.completion.fields.phone.hint}
                        </div>
                      </label>
                      <button
                        disabled={loading}
                        onClick={async () => {
                          const newValue = !completionSettings.requirePhone;
                          setLoading(true);
                          try {
                            const { encryptedApi } = await import('./encryptedApi');
                            const updatedSettings = { ...completionSettings, requirePhone: newValue };
                            await encryptedApi.updateCompletionSettings(updatedSettings);
                            setCompletionSettings(updatedSettings);
                            if (onDataReload) onDataReload();
                          } catch (err) {
                            setError(err.message || 'Failed to update setting');
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
                          backgroundColor: completionSettings.requirePhone ? '#27ae60' : '#7f8c8d',
                          transition: 'background-color 0.3s ease',
                          opacity: loading ? 0.6 : 1,
                          padding: 0
                        }}
                      >
                        <div style={{
                          position: 'absolute',
                          top: '3px',
                          left: completionSettings.requirePhone ? '33px' : '3px',
                          width: '24px',
                          height: '24px',
                          borderRadius: '50%',
                          backgroundColor: 'white',
                          transition: 'left 0.3s ease',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                        }} />
                      </button>
                    </div>

                    {/* Email */}
                    <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <label style={{ color: 'white', flex: 1 }}>
                        {appConfig.ui.adminPanel.completion.fields.email.label}
                        <div style={{ fontSize: '12px', color: '#bdc3c7', marginTop: '4px' }}>
                          {appConfig.ui.adminPanel.completion.fields.email.hint}
                        </div>
                      </label>
                      <button
                        disabled={loading}
                        onClick={async () => {
                          const newValue = !completionSettings.requireEmail;
                          setLoading(true);
                          try {
                            const { encryptedApi } = await import('./encryptedApi');
                            const updatedSettings = { ...completionSettings, requireEmail: newValue };
                            await encryptedApi.updateCompletionSettings(updatedSettings);
                            setCompletionSettings(updatedSettings);
                            if (onDataReload) onDataReload();
                          } catch (err) {
                            setError(err.message || 'Failed to update setting');
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
                          backgroundColor: completionSettings.requireEmail ? '#27ae60' : '#7f8c8d',
                          transition: 'background-color 0.3s ease',
                          opacity: loading ? 0.6 : 1,
                          padding: 0
                        }}
                      >
                        <div style={{
                          position: 'absolute',
                          top: '3px',
                          left: completionSettings.requireEmail ? '33px' : '3px',
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

              {activeTab === 'dangerZone' && (
                <div style={{ backgroundColor: '#34495e', padding: '20px', borderRadius: '8px' }}>
                  <h3 style={{ marginTop: 0, color: '#e74c3c', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {appConfig.ui.adminPanel.dangerZone.title}
                  </h3>
                  <p style={{ color: '#bdc3c7', fontSize: '14px', marginBottom: '20px' }}>
                    {appConfig.ui.adminPanel.dangerZone.description}
                  </p>

                  <div style={{ 
                    backgroundColor: '#2c3e50', 
                    padding: '20px', 
                    borderRadius: '8px',
                    border: '2px solid #e74c3c'
                  }}>
                    <h4 style={{ marginTop: 0, color: '#e74c3c' }}>{appConfig.ui.adminPanel.dangerZone.deleteDatabase.title}</h4>
                    <p style={{ color: '#bdc3c7', fontSize: '14px', marginBottom: '15px' }}>
                      {appConfig.ui.adminPanel.dangerZone.deleteDatabase.description}
                    </p>
                    <ul style={{ color: '#95a5a6', fontSize: '14px', marginBottom: '20px', paddingLeft: '20px' }}>
                      <li>{appConfig.ui.adminPanel.dangerZone.deleteDatabase.items.treeData}</li>
                      <li>{appConfig.ui.adminPanel.dangerZone.deleteDatabase.items.images}</li>
                      <li>{appConfig.ui.adminPanel.dangerZone.deleteDatabase.items.locations}</li>
                      <li>{appConfig.ui.adminPanel.dangerZone.deleteDatabase.items.databaseFile}</li>
                      <li>{appConfig.ui.adminPanel.dangerZone.deleteDatabase.items.authEntry}</li>
                    </ul>
                    
                    {!showDeleteConfirmation ? (
                      <button
                        onClick={() => setShowDeleteConfirmation(true)}
                        style={{
                          padding: '12px 20px',
                          backgroundColor: '#e74c3c',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          fontSize: '14px',
                          fontWeight: '600',
                          cursor: 'pointer'
                        }}
                      >
                        {appConfig.ui.adminPanel.dangerZone.deleteDatabase.deleteButton}
                      </button>
                    ) : (
                      <div style={{ marginTop: '15px' }}>
                        <div style={{ 
                          backgroundColor: '#c0392b', 
                          padding: '15px', 
                          borderRadius: '6px',
                          marginBottom: '15px'
                        }}>
                          <p style={{ color: 'white', fontSize: '14px', fontWeight: 'bold', marginBottom: '10px' }}>
                            {appConfig.ui.adminPanel.dangerZone.deleteDatabase.finalWarning.title}
                          </p>
                          <p style={{ color: '#ecf0f1', fontSize: '13px', marginBottom: '0' }}>
                            {appConfig.ui.adminPanel.dangerZone.deleteDatabase.finalWarning.message}
                          </p>
                        </div>

                        {deleteError && (
                          <div style={{
                            backgroundColor: '#e74c3c',
                            color: 'white',
                            padding: '12px',
                            borderRadius: '6px',
                            marginBottom: '12px',
                            fontSize: '14px'
                          }}>
                            {deleteError}
                          </div>
                        )}

                        <label style={{ display: 'block', marginBottom: '8px', color: '#ecf0f1', fontSize: '14px' }} dangerouslySetInnerHTML={{ __html: appConfig.ui.adminPanel.dangerZone.deleteDatabase.confirmLabel }}>
                        </label>
                        <input
                          type="text"
                          value={deleteConfirmText}
                          onChange={(e) => setDeleteConfirmText(e.target.value)}
                          placeholder={appConfig.ui.adminPanel.dangerZone.deleteDatabase.confirmPlaceholder}
                          style={{
                            width: '100%',
                            padding: '10px',
                            borderRadius: '6px',
                            border: 'none',
                            marginBottom: '12px',
                            fontSize: '14px',
                            boxSizing: 'border-box'
                          }}
                          disabled={loading}
                        />

                        <label style={{ display: 'block', marginBottom: '8px', color: '#ecf0f1', fontSize: '14px' }}>
                          {appConfig.ui.adminPanel.dangerZone.deleteDatabase.adminPasswordLabel}
                        </label>
                        <input
                          type="password"
                          value={deleteAdminPassword}
                          onChange={(e) => setDeleteAdminPassword(e.target.value)}
                          placeholder={appConfig.ui.adminPanel.dangerZone.deleteDatabase.adminPasswordPlaceholder}
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

                        <div style={{ display: 'flex', gap: '10px' }}>
                          <button
                            onClick={handleDeleteFamily}
                            disabled={loading || deleteConfirmText !== 'LÖSCHEN' || !deleteAdminPassword}
                            style={{
                              flex: 1,
                              padding: '12px',
                              backgroundColor: (loading || deleteConfirmText !== 'LÖSCHEN' || !deleteAdminPassword) ? '#7f8c8d' : '#c0392b',
                              color: 'white',
                              border: 'none',
                              borderRadius: '6px',
                              fontSize: '14px',
                              fontWeight: '600',
                              cursor: (loading || deleteConfirmText !== 'LÖSCHEN' || !deleteAdminPassword) ? 'not-allowed' : 'pointer'
                            }}
                          >
                            {loading ? appConfig.ui.adminPanel.dangerZone.deleteDatabase.deleting : appConfig.ui.adminPanel.dangerZone.deleteDatabase.deleteButtonFinal}
                          </button>

                          <button
                            onClick={() => {
                              setShowDeleteConfirmation(false);
                              setDeleteConfirmText('');
                              setDeleteAdminPassword('');
                              setDeleteError('');
                            }}
                            disabled={loading}
                            style={{
                              flex: 1,
                              padding: '12px',
                              backgroundColor: '#95a5a6',
                              color: 'white',
                              border: 'none',
                              borderRadius: '6px',
                              fontSize: '14px',
                              cursor: loading ? 'not-allowed' : 'pointer'
                            }}
                          >
                            {appConfig.ui.adminPanel.dangerZone.deleteDatabase.cancelButton}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
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
              placeholder={appConfig.ui.adminPanel.encryption.enterPasswordPlaceholder}
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
                    // CRITICAL: Pause key checks to prevent auto-logout during encryption operations
                    pauseKeyCheck();
                    console.log('[AdminPanel] 🔄 Paused key availability checks');
                    
                    if (pendingEncryptionAction === 'enable') {
                      // Call enableEncryption with progress callback (password is already in session)
                      const result = await enableEncryption((progress) => {
                        setEncryptionProgress(progress);
                      });
                      
                      // Update session state FIRST with the new salt and key
                      console.log('[AdminPanel] Updating session with encryption enabled and new salt');
                      await updateEncryptionStatus(true, result.salt);
                      
                      // Update local UI state
                      setEncryptionEnabled(true);
                      setEncryptionSalt(result.salt);
                      
                      // Resume key checks BEFORE reloading data
                      console.log('[AdminPanel] ✅ Resuming key availability checks');
                      resumeKeyCheck();
                      
                      setSuccess('Encryption enabled successfully');
                      
                      // Reload all data so UI shows encrypted/decrypted values correctly
                      if (onDataReload) {
                        console.log('[AdminPanel] Reloading data after enabling encryption...');
                        await onDataReload();
                      }
                    } else {
                      // Call disableEncryption with progress callback (password is already in session)
                      await disableEncryption((progress) => {
                        setEncryptionProgress(progress);
                      });
                      
                      // Update session state FIRST
                      console.log('[AdminPanel] Updating session with encryption disabled');
                      await updateEncryptionStatus(false, null);
                      
                      // Update local UI state
                      setEncryptionEnabled(false);
                      setEncryptionSalt(null);
                      
                      // Resume key checks BEFORE reloading data
                      console.log('[AdminPanel] ✅ Resuming key availability checks');
                      resumeKeyCheck();
                      
                      setSuccess('Encryption disabled successfully');
                      
                      // Reload all data so UI shows unencrypted values correctly
                      if (onDataReload) {
                        console.log('[AdminPanel] Reloading data after disabling encryption...');
                        await onDataReload();
                      }
                    }
                  } catch (err) {
                    setError(`Encryption operation failed: ${err.message}`);
                    console.error('Encryption toggle error:', err);
                    // CRITICAL: Resume key checks even on error
                    resumeKeyCheck();
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
    </>
  );
};

export default AdminPanel;
