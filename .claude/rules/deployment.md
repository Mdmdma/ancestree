---
paths:
  - "build-for-deployment.sh"
  - "testdeployment.sh"
  - "ancestree-backend/ecosystem.config.js"
  - "ancestree-deploy/**"
---

# Build & Deployment

## Local Development

- Frontend: `cd ancestree-app && npm run dev` (Vite, port 5173)
- Backend: `cd ancestree-backend && npm run dev` (nodemon, port 3001)
- Test credentials: family `123123`, password `123123`, admin `123123`

## Build

`./build-for-deployment.sh` from project root:
1. Builds React frontend (`npm run build` in ancestree-app) → `dist/`
2. Installs backend production dependencies
3. Copies backend + built frontend to `ancestree-deploy/`
4. Generates `.env.example` with deployment checklist

## Deploy to Production

`./testdeployment.sh`:
1. Builds frontend locally
2. `rsync` syncs `dist/` to `ancestree.ch` server
3. Restarts PM2 service via SSH

## Production Environment

- **Host**: AWS Lightsail
- **Domain**: ancestree.ch / www.ancestree.ch
- **Process manager**: PM2 via `ecosystem.config.js`
  - Fork mode (single instance)
  - Max 10 restarts, 5s kill timeout
  - Logs in `./logs/`
  - Dynamic `.env` loading (no dotenv needed at startup)
- **Port**: 3001 (NODE_ENV=production)
- **Frontend**: Static files served from `dist/` by Express
- **Catch-all route**: Serves `index.html` for client-side routing
- **CORS**: Configured for ancestree.ch domain

## Required Environment Variables

### Backend `.env`
| Variable | Purpose |
|----------|---------|
| AWS_ACCESS_KEY_ID | S3 access |
| AWS_SECRET_ACCESS_KEY | S3 access |
| AWS_REGION | S3 region (eu-central-1) |
| S3_BUCKET_NAME | S3 bucket for images |
| JWT_SECRET | JWT signing key |
| FRONTEND_URL | Production frontend URL |
| PORT | Server port (default 3001) |
| NODE_ENV | 'development' or 'production' |

### Frontend `.env`
| Variable | Purpose |
|----------|---------|
| VITE_API_BASE_URL | Backend API URL (e.g., http://localhost:3001/api) |

## Startup Routines

On server start:
- `initializeAuthDb()` — schema + migrations
- `ensureFamilyHasNodes()` — checks all families
- `migrateAdminSettingsToFamilyDb()` — one-time migration
- Cleanup scheduler starts (periodic orphan cleanup)
