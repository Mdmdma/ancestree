Start the local Ancestree development environment with a clean Vite cache.

## Step 1: Kill existing dev servers

Stop any processes already running on the dev ports:

```bash
lsof -ti:5173 | xargs -r kill -9 2>/dev/null || true
lsof -ti:3001 | xargs -r kill -9 2>/dev/null || true
```

## Step 2: Clear Vite cache

```bash
rm -rf ancestree-app/node_modules/.vite
```

## Step 3: Verify environment configuration

Check that the frontend .env points to localhost:

```bash
grep VITE_API_BASE_URL ancestree-app/.env
```

Expected value: `VITE_API_BASE_URL=http://localhost:3001/api`. If it points elsewhere (e.g., a remote IP or production URL), warn the user and ask if they want to fix it.

Check that the backend .env exists:

```bash
test -f ancestree-backend/.env && echo "Backend .env exists" || echo "WARNING: Backend .env missing"
```

If missing, warn the user that the backend will not start properly.

## Step 4: Start the backend

Run in background:

```bash
cd /home/mathis/Documents/ancestree/ancestree-backend && npm run dev
```

Use `run_in_background: true` for this command.

## Step 5: Start the frontend

Run in background:

```bash
cd /home/mathis/Documents/ancestree/ancestree-app && npm run dev
```

Use `run_in_background: true` for this command.

## Step 6: Report

Tell the user:
- Backend running at http://localhost:3001
- Frontend running at http://localhost:5173
- Test credentials: family `123123`, password `123123`, admin `123123`

## Optional: Database clearing

ONLY if the user explicitly asks to clear databases:

```bash
rm -f ancestree-backend/databases/database_family_*.db
rm -f ancestree-backend/databases/database_auth.db
```

Warn that this deletes all local family data and is irreversible. Do NOT do this unless specifically requested.
