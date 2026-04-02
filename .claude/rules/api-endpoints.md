---
paths:
  - "ancestree-app/src/api.js"
  - "ancestree-app/src/apiClient.js"
  - "ancestree-backend/server.js"
---

# API Layer & Endpoints

## Request Chain

```
Component → apiClient.js (Proxy) → encryptedApi.js (encrypt/decrypt) → api.js (baseApi, fetch) → Backend (Express)
```

- `apiClient.js`: ES6 Proxy wrapping `baseApi`, delegates to `encryptedApi` methods when they exist
- `encryptedApi.js`: Encrypts outgoing data, decrypts incoming responses
- `api.js`: Raw fetch with JWT auth headers. Exports `setAuthToken`, `getAuthToken`, `getSocketServerUrl`, `API_BASE_URL`

**Always import `encryptedApi` or `apiClient` for data operations. Never use raw `api.js` for data.**

## Authentication

- JWT tokens stored in localStorage
- `setAuthToken(token)` / `getAuthToken()`
- Request headers: `Authorization: Bearer TOKEN`, `Content-Type: application/json`, optional `X-Socket-Id`
- Server middleware: `authenticateToken` (required), `optionalAuth` (optional)
- JWT payload: `{ id: familyId, familyName: string }`
- Token expiry: 24 hours

## REST Endpoints

### Auth (`/api/auth/`)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/login` | Verify password, return JWT + user info |
| POST | `/api/auth/register` | Create family + DB + generate salt, return JWT |
| GET | `/api/auth/status` | Check auth status |
| GET | `/api/auth/verify` | Return user info from JWT |
| POST | `/api/auth/admin-login` | Verify admin password |
| POST | `/api/auth/change-family-password` | Update password (re-encryption on client) |
| POST | `/api/auth/change-admin-password` | Update admin password |
| DELETE | `/api/auth/delete-family` | Initiate soft delete |
| POST | `/api/auth/cancel-deletion` | Cancel pending deletion |
| GET | `/api/auth/deletion-status` | Check deletion status |

### Terms (`/api/terms/`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/terms/version` | Get latest terms version |
| GET | `/api/terms/all` | Get all terms versions |
| GET | `/api/terms/status` | Check if user accepted current terms |
| POST | `/api/terms/accept` | Accept terms version |

### Family Settings (`/api/family/`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/family/settings` | Get all family settings |
| POST | `/api/family/street-fields-visibility` | Toggle street fields |
| POST | `/api/family/phone-field-visibility` | Toggle phone field |
| POST | `/api/family/email-field-visibility` | Toggle email field |
| POST | `/api/family/node-creation-lock` | Toggle node creation lock |
| POST | `/api/family/encryption` | Toggle encryption + set salt |

### Admin Settings (`/api/admin/`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/admin/settings` | Get all KV settings |
| GET | `/api/admin/setting/:key` | Get single setting |
| POST | `/api/admin/setting` | Set KV pair |
| POST | `/api/admin/migrate-images` | Migrate S3 image paths |
| GET | `/api/admin/migration-status` | Check S3 migration status |

### Completion Settings (`/api/completion/`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/completion/settings` | Get completion config |
| POST | `/api/completion/settings` | Update completion config |

### Nodes (`/api/nodes`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/nodes` | Get all nodes (encrypted) |
| POST | `/api/nodes` | Create node, broadcasts via Socket.IO |
| PUT | `/api/nodes/:id` | Update node fields |
| DELETE | `/api/nodes/:id` | Delete node (cascade: edges, image_people) |

### Edges (`/api/edges`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/edges` | Get all edges |
| POST | `/api/edges` | Create edge |
| PUT | `/api/edges/:id` | Update edge |
| DELETE | `/api/edges/:id` | Delete edge |

### Images (`/api/images/`)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/images/presigned-upload` | Get S3 PUT URL (5 min expiry) |
| POST | `/api/images/confirm-upload` | Save metadata to DB after S3 upload |
| GET | `/api/images/:id/presigned-url` | Get S3 GET URL (1 hr expiry) |
| POST | `/api/images/presigned-urls` | Batch presigned GET URLs |
| GET | `/api/images` | List all images with tagged people |
| GET | `/api/images/:id` | Single image with people array |
| PUT | `/api/images/:id` | Update description |
| PUT | `/api/images/:id/question` | Toggle has_open_questions |
| PUT | `/api/images/:id/thumbnail` | Update thumbnail S3 key |
| POST | `/api/images/proxy` | Proxy image fetch |
| DELETE | `/api/images/:id` | Delete from DB + S3 |

### Image People (`/api/images/:imageId/people`)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/images/:imageId/people` | Tag person in image (with position) |
| DELETE | `/api/images/:imageId/people/:personId` | Remove person tag |
| PUT | `/api/images/:imageId/people/:personId` | Update tag position |

### Chat (`/api/images/:imageId/chat` and `/api/chat-messages`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/images/:imageId/chat` | Get chat messages for image |
| POST | `/api/images/:imageId/chat` | Post new message |
| DELETE | `/api/images/:imageId/chat/:messageId` | Delete message |
| GET | `/api/chat-messages` | Get all chat messages |
| PUT | `/api/chat-messages/:id` | Update chat message |

### Maintenance
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/reset` | Reset family data |
| POST | `/api/cleanup` | Run cleanup routines |
| POST | `/api/test/create-self-loops` | Debug: create test self-loops |

## Image Upload Flow (3-step)

1. `POST /api/images/presigned-upload` → get S3 PUT URL (5 min expiry)
2. XHR PUT directly to S3 (client-to-S3, bypasses backend)
3. `POST /api/images/confirm-upload` → save metadata to DB

S3 key pattern: `images/{familyName}/{uuid}.{ext}`
Thumbnail pattern: `images/{familyName}/thumbnails/{uuid}.{ext}`
Presigned view URLs expire after 1 hour.

## Socket.IO Events

### Client emits
| Event | Payload | Purpose |
|-------|---------|---------|
| `authenticate` | `{ token }` | Join family room |
| `node:position` | `{ nodeId, position }` | Broadcast drag position |
| `user:cursor` | cursor data | Broadcast cursor position |

### Server broadcasts (to family room)
| Event | Payload |
|-------|---------|
| `authenticated` | `{ familyId, familyName }` |
| `authentication_error` | error message |
| `user:count` | number of connected users |
| `node:position` | `{ nodeId, position }` |
| `user:cursor` | cursor data |
| `node:created` | encrypted node data |
| `node:updated` | encrypted node data |
| `node:deleted` | `{ id }` |
| `edge:created` | encrypted edge data |
| `edge:updated` | encrypted edge data |
| `edge:deleted` | `{ id }` |
| `chat:message` | encrypted chat message |
| `chat:messageDeleted` | `{ id }` |
| `image:created` | encrypted image data |
| `image:updated` | encrypted image data |
| `image:deleted` | `{ id }` |
| `image_people:updated` | image people data |

**Note:** `X-Socket-Id` header sent with API requests to prevent echoing changes back to the originating client.

## Error Handling

- No global error handler; each call throws on non-2xx
- Some retry logic for uploads (exponential backoff)
- Encryption failures log errors but return data as-is (graceful degradation)
