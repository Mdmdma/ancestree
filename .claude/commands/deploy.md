Deploy the Ancestree application to the production server at ancestree.ch.

IMPORTANT: This affects the live production server. Confirm with the user before executing any remote commands.

## Configuration

- Remote: ubuntu@ancestree.ch
- Remote project root: /home/ubuntu/ancestree/
- PM2 process name: ancestree

## Step 1: Pre-flight checks

Run these checks before anything else:

1. Verify project root: both `ancestree-app/` and `ancestree-backend/` directories must exist.
2. Test SSH connectivity:
   ```bash
   ssh -o ConnectTimeout=5 ubuntu@ancestree.ch echo "connected"
   ```
   If this fails, stop immediately.
3. Check for uncommitted changes:
   ```bash
   git status --porcelain
   ```
   If there are uncommitted changes, warn the user and ask whether to proceed.

## Step 2: Detect what changed

Determine what needs deploying by comparing against the remote:

```bash
git diff --name-only origin/main..HEAD
```

If the user specifies a different comparison range or commit, use that instead.

Categorize the changes:
- **Frontend changed**: files under `ancestree-app/src/` or `ancestree-app/index.html` or `ancestree-app/vite.config.js`
- **Backend changed**: files under `ancestree-backend/` (excluding `node_modules/`, `databases/`, `tests/`, `.env`, `logs/`)
- **Backend deps changed**: `ancestree-backend/package.json` or `ancestree-backend/package-lock.json`

Report the categorized changes to the user and ask for confirmation before proceeding.

## Step 3: Build frontend (if frontend changed)

```bash
cd ancestree-app && npm run build
```

Verify the build succeeded and `ancestree-app/dist/` exists and contains files.

## Step 4: Deploy frontend (if frontend changed)

```bash
rsync -avz --delete ancestree-app/dist/ ubuntu@ancestree.ch:/home/ubuntu/ancestree/ancestree-app/dist/
```

## Step 5: Deploy backend (if backend changed)

Sync backend files, excluding server-only data:

```bash
rsync -avz --delete \
  --exclude 'node_modules' \
  --exclude 'databases' \
  --exclude '.env' \
  --exclude 'logs' \
  --exclude 'tests' \
  --exclude '*.db' \
  ancestree-backend/ ubuntu@ancestree.ch:/home/ubuntu/ancestree/ancestree-backend/
```

## Step 6: Install backend dependencies (if backend deps changed)

```bash
ssh ubuntu@ancestree.ch "cd /home/ubuntu/ancestree/ancestree-backend && npm install --production"
```

## Step 7: Restart PM2

```bash
ssh ubuntu@ancestree.ch "pm2 restart ancestree"
```

## Step 8: Verify deployment

Wait 3 seconds, then check PM2 status:

```bash
ssh ubuntu@ancestree.ch "pm2 status ancestree"
```

If the process shows "online", report success. If it shows "errored" or "stopped", show the recent logs:

```bash
ssh ubuntu@ancestree.ch "pm2 logs ancestree --lines 30"
```

## Error handling

- If any step fails, stop immediately and report which step failed with the full error output.
- Do NOT proceed to rsync or PM2 restart if the build failed.
- Do NOT proceed to PM2 restart if rsync failed.
