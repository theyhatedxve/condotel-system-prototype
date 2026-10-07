# Condotel System with NFC Card and Payment

This duplicated project preserves the existing Condotel interface with small static presentation values. Rooms, reservations and guests are read-only. User management, payments, transactions, reports, settings and NFC use the shared placeholder page. Device Management provides administrator-only door-device registration. Business controls, search and notifications are disabled.

Authentication uses NestJS, Prisma/SQLite, Argon2id and signed JWTs. Login, session restoration, logout and password changes remain functional. The topbar account menu displays the signed-in identity. Every active account can view the shared presentation layout; it does not grant business administration privileges because those operations have been removed.

AES-256-GCM protects registered door-device secrets in SQLite. The backend master key is never sent to the frontend. There is no general-purpose encryption/decryption HTTP endpoint.

## Run locally

Use separate terminals in backend and frontend. Install each package with npm ci when dependencies are not installed.

In backend, use .env.example as the template for your local .env without overwriting an existing file. Set JWT_SECRET to a strong independently generated random secret. Set AES_MASTER_KEY to canonical Base64 encoding of exactly 32 random bytes. Generate each secret separately using:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
```

Store secrets only in backend/.env, never in frontend variables or source control. AES validates the key when encryption/decryption is called; login does not require an AES key. A private AES master key has been configured in the current ignored backend .env. Preserve and securely back up this key; replacing or losing it prevents decrypting previously registered device secrets. Unit tests use isolated random keys.

The existing database has already been migrated. For a fresh installation, create an empty backend/prisma/dev.db only if absent (the installed SQLite engine requires an existing file), then run in backend:

```powershell
npx prisma migrate deploy --config prisma7.config.ts
npx prisma generate --config prisma7.config.ts
npm run start:dev
```

The migration removes business tables. Use this database only in the duplicated project. It retains User accounts; do not reset an existing database.

Run in frontend:

```powershell
npm run dev
```

Defaults are http://localhost:5173 for the frontend and http://localhost:3000/api for the API. The optional frontend VITE_API_BASE_URL must include /api; backend FRONTEND_URL controls the permitted frontend origin.

Use an existing account. There are no embedded default credentials. For a new account, POST /api/auth/register accepts email, password (8-128 characters), firstName and lastName, with optional username and phone. Account role/status are assigned by the backend. POST /api/auth/login accepts identifier (email or username) and password. GET /api/auth/me and POST /api/auth/change-password require Authorization: Bearer <token>; password change accepts currentPassword and newPassword.

## Checks

Backend: npm run build, npm run lint, npm test -- --runInBand, npm run test:e2e.
Frontend: npm run build, npm run lint.

The authentication integration tests create and remove an isolated SQLite database inside backend; they do not use real accounts. The existing eight account records were unchanged by cleanup. Browser checks used a separate temporary database.

See [CLEANUP.md](CLEANUP.md) for the complete inventory, deleted-file list, final source trees and verification results.

## Register a door device

Sign in as an administrator and open Device Management in the sidebar. Enter a unique device name and select Register Door Device. Save the generated device ID and secret securely for provisioning the controller, then dismiss the one-time display. The secret is not stored in browser storage and cannot be retrieved through the device list. Use HTTPS when running outside local development.

POST /api/devices accepts { "deviceName": "Room 101 Door" } and returns metadata plus the generated deviceSecret once. GET /api/devices returns metadata only. Both require an active administrator with a completed password-change requirement. Responses use Cache-Control: no-store. SQLite stores deviceKeyCiphertext, deviceKeyIv and deviceKeyAuthTag; no plaintext device secret is persisted.

Migration 20261007020000_register_door_devices adds only the Device table. Registration, provisioning output and listing are implemented; controller firmware, NFC-card authorization, request authentication, door unlocking, key rotation and secret recovery are outside this feature.
