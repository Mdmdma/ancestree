# Client-Side Encryption Feature - Implementation Summary

## Overview
This document describes the complete implementation of client-side encryption for the Ancestree application. All sensitive data (nodes, images) can now be encrypted on the client before being sent to the server, with progress indicators for encryption operations.

## Features Implemented

### 1. Family Management
- **Unique Family Identifier**: Each family has a unique `familyName` (used for login)
- **Display Name**: A visible, user-friendly name shown in the UI (configurable)
- **Purpose/Description**: A text field describing the family tree's purpose
- **Admin Password**: Separate password for accessing admin panel settings

### 2. Client-Side Encryption
- **Algorithm**: AES-256-GCM with PBKDF2 key derivation
- **Key Derivation**: 100,000 iterations of PBKDF2-SHA256
- **Salt**: Per-family random salt (16 bytes) stored on server
- **Encrypted Fields**: All node data (name, birth date, etc.) and image metadata
- **Toggle**: Admin can enable/disable encryption via Admin Panel
- **Password Changes**: Re-encrypts all data when family password changes (when encryption is enabled)

### 3. Progress Indicators
- **Batched Processing**: Processes 10 items at a time to prevent UI blocking
- **Progress Phases**: 
  - Loading (0%)
  - Encrypting/Decrypting (0-50%)
  - Saving (50-100%)
  - Complete (100%)
- **Visual Feedback**: Progress bar with percentage, message, and item counts
- **UI Integration**: Shows progress in both Security and Passwords tabs

## Database Schema Changes

New columns added to `users` table:
```sql
ALTER TABLE users ADD COLUMN display_name TEXT;
ALTER TABLE users ADD COLUMN purpose TEXT;
ALTER TABLE users ADD COLUMN encryption_enabled INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN encryption_salt TEXT;
```

Migration is automatic and safe for existing deployments.

## File Structure

### New Files
- **ancestree-app/src/encryptionUtils.js**: Core Web Crypto API wrapper
  - `generateSalt()`: Creates random 16-byte salt
  - `deriveKey(password, salt)`: PBKDF2 key derivation
  - `encryptValue(value, password, salt)`: Encrypts string/object/array
  - `decryptValue(value, password, salt)`: Decrypts encrypted value
  - `encryptNode/decryptNode`: Node-specific helpers
  - `encryptImage/decryptImage`: Image-specific helpers

- **ancestree-app/src/encryptedApi.js**: Encryption middleware layer
  - `initializeEncryption(password)`: Sets up encryption state
  - `enableEncryption(onProgress)`: Encrypts all existing data
  - `disableEncryption(onProgress)`: Decrypts all data
  - `reEncryptWithNewPassword(oldPwd, newPwd, onProgress)`: Re-encrypts with new password
  - Wrapped API methods: Automatically encrypt/decrypt based on encryption status

### Modified Files
- **ancestree-backend/database.js**: Schema updates with migration logic
- **ancestree-backend/server.js**: New endpoints for family management
  - `GET /api/family/settings`: Returns display name, purpose, encryption status
  - `GET /api/family/purpose/:familyName`: Public purpose preview
  - `POST /api/family/display-name`: Update display name
  - `POST /api/family/purpose`: Update purpose
  - `POST /api/family/encryption`: Update encryption settings
  - Updated `POST /api/auth/register`: Now requires adminPassword and displayName
  - Updated `POST /api/auth/login` & `GET /api/auth/verify`: Include displayName

- **ancestree-app/src/api.js**: New API wrapper methods
  - `getFamilySettings()`, `getFamilyPurpose()`, `updateDisplayName()`, `updatePurpose()`, `setEncryption()`, `updateImage()`

- **ancestree-app/src/AdminPanel.jsx**: Complete redesign
  - Side menu navigation with 3 tabs
  - Family Parameters tab: Edit display name and purpose
  - Passwords tab: Change family/admin passwords with re-encryption support
  - Security tab: Encryption toggle with progress display
  - Progress UI components in both Passwords and Security tabs

- **ancestree-app/src/Login.jsx**: Updated registration form
  - Added `displayName` field (visible name)
  - Added `adminPassword` field (required, min 6 chars)

- **ancestree-app/src/App.jsx**: Initialize encryption on login
  - Calls `encryptedApi.initialize(password)` after successful login

- **ancestree-app/src/AppHeader.jsx**: Display `displayName` instead of `familyName`

- **ancestree-app/src/config.js**: All admin UI text externalized

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new family (requires: familyName, displayName, password, adminPassword)
- `POST /api/auth/login` - Login (returns displayName)
- `GET /api/auth/verify` - Verify JWT (includes displayName)
- `POST /api/auth/admin-login` - Admin panel authentication

### Family Management
- `GET /api/family/settings` - Get family settings (protected)
- `GET /api/family/purpose/:familyName` - Get purpose preview (public)
- `POST /api/family/display-name` - Update display name (protected)
- `POST /api/family/purpose` - Update purpose (protected)
- `POST /api/family/encryption` - Update encryption settings (protected)

## Encryption Data Format

Encrypted values are stored with prefix: `enc:<base64(iv + ciphertext)>`
- IV: 12 bytes (96 bits) for AES-GCM
- Ciphertext: Encrypted data
- Format allows easy detection of encrypted vs. plain values

## Usage Flow

### Registration
1. User enters: familyName (unique ID), displayName (visible), password, adminPassword
2. Backend creates family with all fields
3. Login redirects to main app

### Enable Encryption
1. Admin opens Admin Panel → Security tab
2. Toggles "Enable Encryption" checkbox
3. Progress bar shows: Loading → Encrypting (0-50%) → Saving (50-100%)
4. All existing data encrypted with current family password
5. Server stores encrypted values with "enc:" prefix

### Change Password (with Encryption)
1. Admin opens Admin Panel → Passwords tab
2. Enters: Current Family Password, New Family Password, Confirm
3. Progress bar shows: Decrypting → Re-encrypting → Saving
4. All data decrypted with old password, re-encrypted with new password
5. New salt generated and stored

### Disable Encryption
1. Admin opens Admin Panel → Security tab
2. Toggles "Enable Encryption" checkbox off
3. Progress bar shows: Loading → Decrypting (0-50%) → Saving (50-100%)
4. All data decrypted and stored as plain values

## Security Considerations

1. **Key Derivation**: Uses PBKDF2 with 100k iterations (separate from password hash)
2. **Password Storage**: Family password never stored, only used for key derivation
3. **Salt Storage**: Per-family salt stored on server (not sensitive alone)
4. **Admin Access**: Separate admin password protects Admin Panel
5. **Transport Security**: All data transmitted over HTTPS (in production)
6. **Client-Side Only**: Encryption/decryption happens entirely in browser
7. **Re-encryption**: Required when password changes to maintain security

## Performance

- **Batching**: Processes 10 items per batch to avoid UI blocking
- **Parallel Processing**: Each batch processed with `Promise.all()`
- **Progress Updates**: Real-time feedback prevents user confusion
- **Memory Efficient**: Processes in chunks rather than loading all at once

## Testing Checklist

- [ ] Register new family with all fields
- [ ] Login and verify display name in header
- [ ] Open Admin Panel and verify authentication
- [ ] Edit display name and purpose
- [ ] Enable encryption and verify progress display
- [ ] Add/edit nodes with encryption enabled
- [ ] Change family password with encryption (should show progress)
- [ ] Change admin password
- [ ] Disable encryption and verify data remains intact
- [ ] Verify encrypted data on server (should have "enc:" prefix)

## Future Enhancements

1. Export/import encrypted backup files
2. Key rotation without password change
3. Encryption analytics (how much data encrypted)
4. Multi-device sync with encrypted data
5. Encrypted sharing between families

## Dependencies

- **Web Crypto API**: Built-in browser encryption (no external libraries)
- **React**: UI components and state management
- **Express**: Backend REST API
- **SQLite**: Database storage

## Configuration

All UI text is externalized in `ancestree-app/src/config.js` under `appConfig.ui.adminPanel` and `appConfig.ui.adminPanelCommon`.

## Troubleshooting

**Q: Encryption toggle doesn't work?**
- Check browser console for errors
- Verify family password is set (login required)
- Ensure backend encryption endpoints are accessible

**Q: Password change fails?**
- If encryption enabled, current password is required
- Verify new password meets minimum length (6 chars)
- Check progress for specific error phase

**Q: Progress stuck?**
- Check network tab for failed API calls
- Look for large dataset (may take time)
- Verify batch processing is not blocked

## Migration from Existing Setup

1. Update backend: `npm install` in `ancestree-backend/`
2. Restart backend server (migrations run automatically)
3. Update frontend: `npm install` in `ancestree-app/`
4. Rebuild frontend: `npm run build`
5. Existing families will have default values:
   - `display_name`: NULL (can be set in Admin Panel)
   - `purpose`: NULL (can be set in Admin Panel)
   - `encryption_enabled`: 0 (disabled by default)
   - `admin_password`: Family password hash (can be changed separately)

## Credits

Implemented following best practices from:
- OWASP cryptographic storage guidelines
- Web Crypto API documentation
- React performance optimization patterns
- Ancestree project conventions (see `.github/instructions/ancestree.instructions.md`)
