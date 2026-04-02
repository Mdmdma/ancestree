# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Ancestree is a family tree visualization and management web app. React frontend (Vite) + Node.js/Express/SQLite backend. Users create interactive family trees, manage relationships, attach photos (AWS S3), view locations on OpenStreetMap, and collaborate in real-time via WebSocket. All sensitive data is AES-256 encrypted client-side before reaching the backend.

## Development Commands

### Frontend (`ancestree-app/`)
```bash
cd ancestree-app && npm install
npm run dev        # Vite dev server on port 5173
npm run build      # Production build to dist/
npm run preview    # Preview production build
npm run lint       # ESLint
```

### Backend (`ancestree-backend/`)
```bash
cd ancestree-backend && npm install
npm start          # Express server on port 3001
npm run dev        # nodemon with auto-restart
```

### Deployment
```bash
./build-for-deployment.sh   # Builds frontend + backend into ancestree-deploy/
```

Test credentials (from .env): family name `123123`, password `123123`, admin password `123123`.

## Knowledge Files (`.claude/rules/`)

These load automatically when you access files in the matched paths. Read the relevant knowledge file BEFORE modifying any of these subsystems — it saves re-reading thousands of lines of source.

| File | Scope | Paths |
|------|-------|-------|
| `encryption-system.md` | 3-layer encryption architecture, field definitions, session management | `src/encryption*`, `src/encryptedApi*` |
| `database-architecture.md` | Per-family SQLite isolation, full schema, migrations, cleanup | `database.js`, `databases/**` |
| `reactflow-tree-system.md` | Node/edge types, handle system, ELK layout, 9 connection validation rules | `FamilyTree.jsx`, `*Node.jsx`, `*Edge.jsx` |
| `api-endpoints.md` | 3-tier API chain, all REST endpoints, Socket.IO events, S3 integration | `api.js`, `apiClient.js`, `server.js` |
| `deployment.md` | Build pipeline, AWS Lightsail, PM2, environment variables | `build-for-deployment.sh`, `ecosystem.config.js` |

## Custom Agents (`.claude/agents/`)

Agents auto-delegate when Claude detects relevant work:

| Agent | Model | Purpose |
|-------|-------|---------|
| `encryption` | opus | Encryption field changes, key management, security-critical modifications |
| `database` | sonnet | Schema changes, migrations, cleanup routines, SQLite queries |
| `frontend` | sonnet | React components, ReactFlow changes, Tailwind styling, UI work |
| `deploy` | sonnet | Build verification, deployment to production |
| `i18n` | haiku | Adding/updating translations, i18n coverage checks |

## Architecture

### Two-package monorepo
- `ancestree-app/` — React 19 + Vite + Tailwind CSS + ReactFlow (tree viz) + Socket.io client
- `ancestree-backend/` — Express + SQLite3 + Socket.io server + AWS S3

### Key patterns
- **Family-based DB isolation**: `database_auth.db` (central auth) + `database_family_[name].db` per family
- **Client-side encryption**: PBKDF2 key derivation → AES-256-GCM. Always use `encryptedApi`, never raw `api.js`
- **Real-time**: Socket.io WebSocket for multi-user editing, chat, presence
- **REST API**: All endpoints under `/api/*` in `server.js`, JWT auth

## Key Conventions

### Styling
- **Tailwind CSS is mandatory for all new features**
- Exception: ReactFlow components (PersonNode, FamilyNode, edges) keep existing inline styles
- When reworking existing components to Tailwind, ask permission first

### Internationalization (i18n)
- German is the source language — add new text to `locales/de.js` first, then `locales/en.js`
- Use `useTranslation` hook: `const { t } = useTranslation();` then `t.ui.section.key`
- All user-facing text must use the translation system, no hardcoded strings

### Skip marker system ("000")
Fields can be marked "intentionally empty" with `000` (or `+000` for phone). Skip markers count as "filled" for completion checks, are hidden in tree display, and bypass format validation. Core logic in `skipMarkerUtils.js`.

### Android file upload (critical)
Android file pickers return stale content URIs. Must read file to memory immediately in the event handler — never store raw File objects in React state. Reference: `ImageGallery.jsx` → `handleFileSelection()`.

### Code patterns
- Functional React components with hooks throughout
- `useCallback`/`useMemo`/`React.memo` for performance
- ELK layout engine for tree positioning (computationally expensive, use sparingly)
- Geocoding via OSM Nominatim with caching and rate limiting (`geocodingService.js`)

## Documentation
- `.github/instructions/ancestree.instructions.md` — comprehensive project guidelines
- `.github/instructions/i18n.instructions.md` — translation workflow
- `MAP_SETUP.md`, `AWS_S3_SETUP.md`, `AWS_LIGHTSAIL_DEPLOYMENT.md` — setup guides
- `TROUBLESHOOTING.md` — common issues and solutions
