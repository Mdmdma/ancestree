---
applyTo: '**'
---
# Ancestree — Project Introduction & AI/Coding Guidelines

## Project Overview
Ancestree is a family tree visualization and management web app. It combines a React-based frontend (Vite) with a lightweight Node/SQLite backend to store nodes (people), edges (relationships) and media (images). The UI supports editing people, drawing relationships, viewing locations on OpenStreetMap, and tagging people in images.

## Project Goals
- Provide an intuitive editor for family trees.
- Make it easy to attach and tag photos and locations to people.
- Keep code maintainable, testable and performant for medium-sized trees.
- Encourage collaboration with clear API and contributor guidelines.

## Tech Stack
- Frontend: React (JSX), Vite, **Tailwind CSS** (mandatory for new features), ReactFlow (tree visualization)
- Backend: Node.js (Express), SQLite with family-based database architecture
- Real-time: Socket.io for WebSocket collaboration features
- Security: Client-side AES-256 encryption for all sensitive data
- Deployment: Simple Node server, static frontend served by Vite or built assets
- External services: OpenStreetMap (OSM) for maps and Nominatim for geocoding, AWS S3 (for image storage)

## High-level Architecture
- Frontend communicates with backend via REST endpoints under `/api/*`.
- **Family-based Database Architecture**: 
  - `database_auth.db` - Central authentication database containing users table
  - `database_family_[familyname].db` - Separate SQLite database per family for data isolation
  - Each family has independent: nodes, edges, images, image_people, chat_messages tables
- **Client-side Encryption Flow**:
  - Password → PBKDF2 key derivation → AES-256-GCM encryption
  - All sensitive data (names, addresses, dates) encrypted before sending to backend
  - Encryption key cached in session, derived once on login
  - Per-family encryption salt stored in users table
- **Real-time Collaboration**: WebSocket server for multi-user editing and live updates
- Server performs periodic cleanup tasks (orphan references, duplicate edges).

## Key Files & Directories

### Frontend (`ancestree-app/src/`)
**Core Application**
- `App.jsx` - Main application component, routing, authentication state
- `main.jsx` - Application bootstrap and React root
- `FamilyTree.jsx` - Main tree visualization using ReactFlow, ELK layout engine
- `AppHeader.jsx` - Top navigation and family controls

**Node & Edge Components**
- `PersonNode.jsx` - Individual person card in tree
- `FamilyNode.jsx` - Family group node
- `PartnerEdge.jsx` - Partner relationship connector
- `BloodlineEdge.jsx`, `BloodlineEdgeHidden.jsx`, `BloodlineEdgeFake.jsx` - Parent-child relationships

**Views & Features**
- `Login.jsx` - Authentication and registration
- `NodeEditor.jsx` - Person detail editor modal
- `ImageGallery.jsx` - Photo upload, viewing, and tagging
- `PictureSlideshow.jsx` - Image carousel for person's photos
- `OpenStreetMapView.jsx` - Location visualization on map
- `Sidebar.jsx` - Tree navigation and controls
- `AdminPanel.jsx` - Family settings and encryption management
- `ChatComponent.jsx` - Real-time collaboration chat

**Encryption System** (Critical for data security)
- `encryptionSession.js` - Session manager, key derivation, state management
- `encryptedApi.js` - API wrapper that auto-encrypts/decrypts data
- `encryptionUtils.js`, `encryptionUtilsOptimized.js` - AES-256-GCM crypto functions
- `encryptionFieldDefinitions.js` - Defines which fields get encrypted per entity
- `encryptionBatchOperations.js` - Batch encryption for data migration

**API & Services**
- `api.js` - Base API client (unencrypted endpoints)
- `encryptedApi.js` - Encrypted API wrapper (use this for all data operations)
- `geocodingService.js`, `geocodingUtils.js` - OSM Nominatim geocoding with caching
- `apiClient.js` - Low-level HTTP client

**Hooks & Utilities**
- `hooks/useSocket.js` - WebSocket connection for real-time collaboration
- `hooks/useDebounce.js` - Debounce utility for search/input
- `performanceUtils.js` - Performance monitoring
- `exportUtils.js` - Data export functionality

**UI Components**
- `components/Button.jsx` - Reusable button component (Tailwind)
- `components/DescriptionTextarea.jsx` - Styled textarea
- `components/AddressAutocomplete.jsx` - Address input with OSM geocoding

### Backend (`ancestree-backend/`)
- `server.js` - Express routes, authentication, WebSocket server, cleanup logic
- `database.js` - SQLite schema, family database management, migrations
- `encryption.js` - Server-side password hashing (bcrypt)
- `databases/` - Directory containing all SQLite database files
  - `database_auth.db` - Authentication database
  - `database_family_*.db` - Per-family data databases
- `databases_backup/` - Automated database backups
- `logs/` - Server logs

### Documentation
- `MAP_SETUP.md` - OpenStreetMap integration setup
- `AWS_S3_SETUP.md` - AWS S3 image storage setup
- `AWS_LIGHTSAIL_DEPLOYMENT.md` - Production deployment guide
- `TROUBLESHOOTING.md` - Common issues and solutions
- `ERROR_SCENARIOS.md` - Known error conditions and testing scenarios
- `PLAYWRIGHT_CONSOLE_REPORT.md` - Latest browser console test report

## Local Development
1. Backend
   - cd `ancestree-backend`
   - npm install
   - npm start (default port 3001)
2. Frontend
   - cd `ancestree-app`
   - npm install
   - npm run dev (Vite, default port 5173)
3. Environment Variables
   - Create `.env` file in `ancestree-app/` directory
   - Testing: `VITE_TEST_FAMILY_NAME=123123`, `VITE_TEST_PASSWORD=123123`, `VITE_TEST_ADMIN_PASSWORD=123123`
   - Backend URL configured in `api.js` if needed (default: `http://localhost:3001`)

## API Conventions
- JSON REST endpoints under `/api/*`.
- Use 200 for success with JSON payload, 4xx for client errors, 5xx for server errors.
- For destructive operations, ensure idempotency where practical.
- Backend exposes `GET /api/nodes` (returns full nodes table) and `POST /api/cleanup` for maintenance.

## Encryption & Security Architecture

### Client-Side Encryption Flow
All sensitive data is encrypted client-side before being sent to the backend:

1. **Login/Key Derivation**:
   - User enters family password
   - `encryptionSession.js` derives AES key using PBKDF2 (10,000 iterations)
   - Key cached in session for performance (not stored permanently)
   - Salt retrieved from `database_auth.db` users table

2. **Data Encryption**:
   - All API calls go through `encryptedApi.js` wrapper
   - Automatically encrypts fields defined in `encryptionFieldDefinitions.js`
   - Encrypted values prefixed with `enc:` marker
   - Uses AES-256-GCM via `encryptionUtilsOptimized.js`

3. **Data Decryption**:
   - API responses automatically decrypted by `encryptedApi.js`
   - Key retrieved from session cache (no re-derivation needed)
   - Failed decryption logged but doesn't crash app

### Encrypted Fields
Defined in `encryptionFieldDefinitions.js`:
- **Nodes (People)**: name, surname, maidenName, birthDate, deathDate, street, houseNumber, city, zip, country, phone, email, latitude, longitude, addressHash
- **Edges (Relationships)**: All relationship data
- **Images**: File paths and metadata
- **Chat Messages**: Message content

### Using Encryption APIs

**ALWAYS use `encryptedApi` for data operations**, not the base `api`:

```javascript
// ✅ CORRECT - Auto-encrypts/decrypts
import { encryptedApi } from './encryptedApi';
const nodes = await encryptedApi.loadNodes();
await encryptedApi.updateNode(nodeId, nodeData);

// ❌ WRONG - No encryption
import { api } from './api';
const nodes = await api.get('/nodes'); // Don't use this!
```

**When implementing new features:**
1. Add encrypted fields to `encryptionFieldDefinitions.js`
2. Use `encryptedApi` for all CRUD operations
3. Test with encryption enabled/disabled
4. Never send sensitive data through base `api`

### Session Management
- `encryptionSession.js` manages encryption state
- Key functions:
  - `initializeSession(password, familySettings)` - On login
  - `isEncryptionEnabled()` - Check if encryption active
  - `getDerivedKey()` - Get cached encryption key
  - `clearSession()` - On logout, clears key from memory

### Security Best Practices
- Encryption key never sent to backend
- Backend only stores encrypted data (cannot decrypt)
- Each family has unique salt in `database_auth.db`
- Password changes require re-encryption of all data
- Admin operations require separate admin password

## Database Integrity
- Prefer foreign keys with `ON DELETE CASCADE` for image-person associations.
- Keep cleanup routines (orphaned references, duplicate edges) running periodically and available via manual endpoint.

## Coding Standards
- Follow existing code style (functional React components, hooks). Keep changes minimal and consistent with surrounding code.
- **Tailwind CSS is MANDATORY for all new features** - no inline styles or CSS modules for new code.
- **For reworking existing components**: ALWAYS ask permission before transitioning to Tailwind.
- **Exception**: ReactFlow components (PersonNode, FamilyNode, edges) - keep existing styling for now.
- **Style preservation**: When using Tailwind, maintain the existing visual appearance and design language.
- Use `useCallback`, `useMemo`, and dependency arrays correctly to avoid stale closures and reference errors.
- Avoid recreating heavy objects (maps, markers) unnecessarily; update in place when possible to preserve state/animation.
- Keep UI responsive: display loading states, avoid blocking main thread during geocoding or heavy loops.
- Use descriptive variable names; keep helper functions small and single-purpose.

## Accessibility & UX
- Provide keyboard accessible controls and focus management for dialogs/modals.
- Use clear visual feedback for actions (loading spinners, non-blocking toasts, map animations).

## Testing & Validation
- **Test credentials** (stored in `.env`): 
  - Family name: `VITE_TEST_FAMILY_NAME=123123`
  - Password: `VITE_TEST_PASSWORD=123123`
  - Admin password: `VITE_TEST_ADMIN_PASSWORD=123123`
- **Playwright MCP Testing Workflow** (required after completing longer tasks):
  1. Navigate to `http://localhost:5173`
  2. Login with test credentials (123123 / 123123)
  3. Use the implemented feature in expected ways
  4. Check browser console for errors: `mcp_playwright_browser_console_messages({onlyErrors: true})`
  5. Verify no unapproved errors exist
- **SQLite MCP**: Use only when needed for database queries or validation
  - Database path: `/home/mathis/Documents/ancestree/ancestree-backend/databases/database_family_123123.db`
  - Example: `mcp_sqlite-query_execute_sqlite_query({db_path: "...", sql_query: "SELECT * FROM nodes"})`
- **Known Acceptable Errors** (can be ignored during testing):
  - React DevTools extension suggestions (INFO level)
  - Vite HMR connection messages (LOG level)
  - Autocomplete attribute suggestions (VERBOSE level)
  - Performance monitoring logs (DEBUG level)
- **Minimum Criteria to Complete Task**:
  - No console errors (ERROR level) that are not in the approved list
  - Feature works as expected in browser
  - Data persists correctly in database (verify with SQLite MCP if needed)
  - Encryption/decryption working if feature involves sensitive data
- Manual testing is the baseline; add unit tests for backend logic where practical.
- Validate critical flows: node CRUD, image upload/tagging, map geocoding, cleanup routines.

## Performance Considerations
- **Client-side Encryption Overhead**:
  - Encryption key derived once on login and cached in session
  - Use batch operations (`encryptionBatchOperations.js`) for mass encryption/decryption
  - Key derivation takes ~250-300ms - avoid re-deriving unnecessarily
  - Encrypted data adds ~30% size overhead (base64 encoding)
- **React Rendering Optimization**:
  - Use `React.memo` for expensive components (PersonNode, FamilyNode)
  - Use `useCallback` for event handlers to prevent child re-renders
  - Use `useMemo` for computed values and filtered lists
  - Avoid inline object/array creation in render (causes reference changes)
- **Batch Processing**:
  - Geocoding: Use `queueBatchGeocoding()` to process multiple addresses with rate limiting
  - Encryption: Use `encryptionBatchOperations.js` for migrating data
  - Database: Batch INSERT/UPDATE operations when possible
- **ReactFlow Performance**:
  - Use `nodeOrigin` to control node positioning without recalculation
  - Minimize edge re-renders by memoizing edge components
  - Use ELK layout engine calculations sparingly (computationally expensive)
- Cache geocoding results where possible to avoid hitting Nominatim API limits.
- Throttle batch operations (e.g., when geocoding many addresses) and show progress.
- For large trees, avoid rendering all nodes in heavy components — use virtualization for lists.

## Security & Secrets
- Do not commit API keys or production DB files. Use `.env` and environment-specific config.
- Sanitize inputs on the server; use parameterized queries for SQLite to avoid injection.

## Contributor Workflow
- Keep PRs focused and small. Include migration notes when DB schema changes.

## How AI Should Help (Guidelines for assistant behavior)
- When suggesting code changes, keep edits minimal and explain intent clearly.
- Prefer using existing utilities and patterns already present in the repo.
- Avoid introducing large new dependencies unless justified; document why and how to install.
- When modifying backend, ensure SQL statements are safe and provide rollback/migration notes.
- When touching UI/UX, include before/after behavior and small reproducible changes.
- **NEVER create new markdown files without explicit user permission**.
- Only update existing documentation files when needed (setup guides, API docs, migration guides).
- Do not create progress reports or summaries in markdown format.

## Task Planning & Implementation Workflow

### For Large or Complex Tasks
**ALWAYS create a todo list using the `manage_todo_list` tool before starting implementation**:
1. Break down the task into specific, actionable items
2. Identify dependencies between tasks
3. Estimate complexity and potential issues
4. **If questions or uncertainties arise while planning, STOP and ask the user for clarification BEFORE proceeding**

### Question Policy - CRITICAL
**HALT all implementation immediately if:**
- Requirements are ambiguous or unclear
- Multiple valid approaches exist and user preference is unknown
- Breaking changes might affect existing functionality
- Major architectural decisions are needed
- You need clarification on expected behavior
- Technical constraints or limitations are discovered

**When questions arise:**
1. Mark current todo as "not-started" 
2. Clearly state what is unclear
3. Present options if applicable
4. Wait for user response before continuing

### Todo List Guidelines
- Use descriptive titles (3-7 words)
- Include specific file paths and function names in descriptions
- Mark ONE task as "in-progress" at a time
- Mark tasks "completed" immediately after finishing
- Update status frequently for user visibility

**Example Todo Structure:**
```
1. [in-progress] Update geocoding service to use OSM Nominatim
   Description: Replace Google Maps API calls in geocodingService.js with Nominatim endpoints
2. [not-started] Update AddressAutocomplete component  
   Description: Modify AddressAutocomplete.jsx to use OSM search instead of Google Places
```

## Priorities & Next Tasks (starter ideas)
1. Improve smooth map interactions and marker animations (already in progress).  
2. Add caching for geocoding and limit concurrency to avoid Nominatim API throttling.  
3. Improve image tagging UX (dragging, auto-suggest people by name).  
4. Add unit tests for cleanup routines and edge deduplication.  
5. Create a basic CI step to run lint/tests on PRs.

## Contacts & Context
- Repo owner: Mdmdma (main branch).  
- Use existing project docs for setup (`MAP_SETUP.md` for OpenStreetMap integration).