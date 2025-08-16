---
applyTo: '**'
---
# Ancestree — Project Introduction & AI/Coding Guidelines

## Project Overview
Ancestree is a family tree visualization and management web app. It combines a React-based frontend (Vite) with a lightweight Node/SQLite backend to store nodes (people), edges (relationships) and media (images). The UI supports editing people, drawing relationships, viewing locations on Google Maps, and tagging people in images.

## Project Goals
- Provide an intuitive editor for family trees.
- Make it easy to attach and tag photos and locations to people.
- Keep code maintainable, testable and performant for medium-sized trees.
- Encourage collaboration with clear API and contributor guidelines.

## Tech Stack
- Frontend: React (JSX), Vite, CSS modules / inline styles
- Backend: Node.js (Express), SQLite (local file ancestree.db)
- Deployment: Simple Node server, static frontend served by Vite or built assets
- External services: Google Maps JavaScript API (Maps + Geocoding), AWS S3 (for image storage)

## High-level Architecture
- Frontend communicates with backend via REST endpoints under `/api/*`.
- Database tables: `nodes`, `edges`, `images`, `image_people` (many-to-many), etc.
- Server performs periodic cleanup tasks (orphan references, duplicate edges).

## Key Files & Directories
- `ancestree-app/src/` — frontend React code (components, views, api wrapper)
  - `MapView.jsx` — Google Maps integration and location UI
  - `ImageGallery.jsx`, `PersonPictureSlideshow.jsx` — image upload & tagging
  - `App.jsx`, `main.jsx` — app bootstrap and global state
- `ancestree-backend/` — server and database
  - `server.js` — Express routes and cleanup logic
  - `database.js` — SQLite schema and migrations
  - `ancestree.db` — local SQLite DB (do not commit sensitive production DB)
- Docs: `GOOGLE_MAPS_SETUP.md`, `AWS_S3_SETUP.md`, `IMAGE_FEATURE_README.md`

## Local Development
1. Backend
   - cd `ancestree-backend`
   - npm install
   - npm start (default port 3001)
2. Frontend
   - cd `ancestree-app`
   - npm install
   - npm run dev (Vite, default port 5173)
3. Environment
   - Add `.env` entries: `VITE_GOOGLE_MAPS_API_KEY` for Maps, backend URL in `api.js` if needed

## API Conventions
- JSON REST endpoints under `/api/*`.
- Use 200 for success with JSON payload, 4xx for client errors, 5xx for server errors.
- For destructive operations, ensure idempotency where practical.
- Backend exposes `GET /api/nodes` (returns full nodes table) and `POST /api/cleanup` for maintenance.

## Database Integrity
- Prefer foreign keys with `ON DELETE CASCADE` for image-person associations.
- Keep cleanup routines (orphaned references, duplicate edges) running periodically and available via manual endpoint.

## Coding Standards
- Follow existing code style (functional React components, hooks). Keep changes minimal and consistent with surrounding code.
- Use `useCallback`, `useMemo`, and dependency arrays correctly to avoid stale closures and reference errors.
- Avoid recreating heavy objects (maps, markers) unnecessarily; update in place when possible to preserve state/animation.
- Keep UI responsive: display loading states, avoid blocking main thread during geocoding or heavy loops.
- Use descriptive variable names; keep helper functions small and single-purpose.

## Accessibility & UX
- Provide keyboard accessible controls and focus management for dialogs/modals.
- Use clear visual feedback for actions (loading spinners, non-blocking toasts, map animations).

## Testing & Validation
- Manual testing is the baseline; add unit tests for backend logic where practical.
- Validate critical flows: node CRUD, image upload/tagging, map geocoding, cleanup routines.

## Performance Considerations
- Cache geocoding results where possible to avoid hitting API limits.
- Throttle batch operations (e.g., when geocoding many addresses) and show progress.
- For large trees, avoid rendering all nodes in heavy components — use virtualization for lists.

## Security & Secrets
- Do not commit API keys or production DB files. Use `.env` and environment-specific config.
- Sanitize inputs on the server; use parameterized queries for SQLite to avoid injection.

## Contributor Workflow
- Create feature branches per task; open PRs to `main` with clear descriptions and screenshots when applicable.
- Keep PRs focused and small. Include migration notes when DB schema changes.

## How AI Should Help (Guidelines for assistant behavior)
- When suggesting code changes, keep edits minimal and explain intent clearly.
- Prefer using existing utilities and patterns already present in the repo.
- Avoid introducing large new dependencies unless justified; document why and how to install.
- When modifying backend, ensure SQL statements are safe and provide rollback/migration notes.
- When touching UI/UX, include before/after behavior and small reproducible changes.

## Priorities & Next Tasks (starter ideas)
1. Improve smooth map interactions and marker animations (already in progress).  
2. Add caching for geocoding and limit concurrency to avoid API throttling.  
3. Improve image tagging UX (dragging, auto-suggest people by name).  
4. Add unit tests for cleanup routines and edge deduplication.  
5. Create a basic CI step to run lint/tests on PRs.

## Contacts & Context
- Repo owner: Mdmdma (main branch).  
- Use existing project docs for setup (`GOOGLE_MAPS_SETUP.md`, `IMAGE_FEATURE_README.md`).