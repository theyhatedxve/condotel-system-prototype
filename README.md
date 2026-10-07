# Secure Web-Based Condotel Reservation, Payment, and NFC Card Access Control System

**Short name:** Condotel System with NFC Card and Payment

This project is a simplified Condotel web application that preserves the original interface while demonstrating secure account authentication and encrypted storage of door-device secrets.

The working security features are **Argon2id password hashing**, **JWT authentication**, and **AES-256-GCM encryption**. The wider Condotel features named in the project title are represented by presentation pages or placeholders; this version is not a complete reservation, payment, or physical door-access system.

For an explanation of each folder, file, class, and function, read [FUNCTIONS_GUIDE.md](FUNCTIONS_GUIDE.md).

## Reading this documentation

Start here to understand what the system does and how to run it. Then use [FUNCTIONS_GUIDE.md](FUNCTIONS_GUIDE.md) to follow each source file, its functions, and the login and device-registration request flows. Configuration, database migrations, tests, generated files, and stylesheets are also explained there.

## What the system does

| Feature | Current behavior |
| --- | --- |
| Login and session restoration | Verifies credentials against SQLite and uses a signed JWT to identify the account. |
| Account registration | Backend API creates accounts and stores Argon2id password hashes. There is no registration screen or automatic administrator creation. |
| Change Password | Verifies the current password, hashes the replacement, and clears the required-password-change flag. |
| Sign Out | Removes the stored token and clears the frontend session. |
| Device Management | Administrators can register door devices and view their names, IDs, and registration dates. |
| Device-secret encryption | Generates a separate secret for each device and stores it encrypted with AES-256-GCM. |
| Dashboard, Guests, Rooms, Reservations | Display small static examples. They do not create or update business records. Dashboard totals are illustrative. |
| User Management, Payments, Transactions, Reports, Settings, NFC Management | Show the shared placeholder page. |
| Topbar search and notifications | Visible but disabled. |

My Profile has been removed. Change Password remains available in the account menu.

## Technology used

| Area | Technology and purpose |
| --- | --- |
| Frontend | React, React Router, Vite, CSS, and Lucide icons provide pages and navigation. |
| API requests | Axios attaches the current bearer token to backend requests. |
| Backend | NestJS and TypeScript provide controllers, services, validation, and dependency injection. |
| Database | SQLite stores accounts and encrypted device records through Prisma. |
| Password protection | Argon2id provides one-way password hashing and verification. |
| Session authentication | Passport JWT verifies signed, expiring access tokens. |
| Device-secret protection | Node's built-in crypto module implements AES-256-GCM. |

## How authentication works

1. A user submits an email address or username and a password.
2. The backend finds the account and checks that it is active.
3. Argon2 verifies the submitted password against the stored hash. The plaintext password is not stored.
4. The backend returns a signed JWT and account details that exclude the password hash.
5. The frontend stores the token in sessionStorage, or localStorage when Remember Me is selected.
6. Protected API requests include that token. The backend verifies its signature and expiration and checks the account again.
7. Accounts with `mustChangePassword` are redirected by the frontend to Change Password. Device operations also reject administrators with this flag until it is cleared.

Sign Out clears the browser's stored token; it does not revoke an already-issued JWT on the server. There is no refresh-token or token-revocation service in this version.

## How AES is used

The implemented function is **Register Door Device**.

1. An administrator enters a unique name, such as `Room 101 Door`.
2. The backend generates a random 32-byte device secret.
3. The existing EncryptionService encrypts that secret using the backend-only `AES_MASTER_KEY` and a fresh random 12-byte IV.
4. SQLite stores the device ID, name, creation date, ciphertext, IV, and 16-byte authentication tag. Binary encryption values are represented as Base64 strings.
5. The registration response shows the original device secret once for provisioning. The device list returns metadata only.
6. The administrator saves the device ID and secret securely and dismisses the one-time display.

The **device secret** belongs to one controller. The **AES master key** protects all stored device secrets and stays on the backend. They are different keys.

The backend encryption service can decrypt stored values using the same master key and verify their authentication tags. The integration tests demonstrate this using persisted device data. There is no public decrypt or secret-retrieval endpoint.

Device registration does not provision an ESP32 automatically, authenticate controller messages, read NFC cards, authorize reservations, or unlock doors. Those features have not been implemented.

## Project structure

```text
condotel-system/
  README.md                 System overview and local setup
  FUNCTIONS_GUIDE.md        Folder, file, and function reference
  CLEANUP.md                Historical cleanup report
  backend/
    src/
      auth/                Registration, login, JWT, password changes
      devices/             Door-device registration and listing
      prisma/              Shared database connection
      security/            AES encryption and tests
      generated/prisma/    Generated Prisma Client
      app.module.ts        Backend module composition
      main.ts              Backend startup
    prisma/                Database schema and migration history
    test/                  Isolated integration tests
  frontend/
    src/
      features/            Authentication, devices, and presentation pages
      layouts/             Sidebar, topbar, and shared page shell
      routes/              URL mapping and authentication redirects
      services/            Shared HTTP client
      styles/              Theme and presentation styles
      utils/               Display formatting helpers
      main.jsx             Frontend startup
    public/                Static favicon
```

## Run locally

Use a Node.js/npm installation compatible with the versions in each package manifest. Run backend and frontend in separate terminals. Commands below are relative to this project root unless stated otherwise.

### 1. Install dependencies

```powershell
cd backend
npm ci
cd ../frontend
npm ci
```

### 2. Configure the backend

Use [backend/.env.example](backend/.env.example) as the template for `backend/.env`. Do not overwrite an existing local configuration.

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | SQLite connection string; local example: `file:./prisma/dev.db`. |
| `PORT` | Backend port; defaults to `3000`. |
| `FRONTEND_URL` | Allowed browser origin; defaults to `http://localhost:5173`. |
| `JWT_SECRET` | Private signing secret. Required for backend startup. |
| `JWT_EXPIRES_IN_SECONDS` | Positive integer token lifetime; defaults to `3600`. |
| `AES_MASTER_KEY` | Canonical Base64 encoding of exactly 32 random bytes. Required when encrypting/decrypting device secrets. |

For a new configuration, generate independent random values for JWT_SECRET and AES_MASTER_KEY by running this command separately for each:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
```

A private AES master key was configured in this workspace's ignored backend `.env` during device-feature setup. Preserve it and keep a secure backup with the database recovery plan. Replacing or losing it prevents decryption of existing device secrets. Never put it in frontend variables or source control. Tests use separate random keys.

### 3. Apply migrations and generate Prisma Client

Run inside `backend`. For a fresh installation, create the empty database file only if it does not already exist:

```powershell
if (-not (Test-Path -LiteralPath 'prisma/dev.db')) {
  New-Item -ItemType File -Path 'prisma/dev.db' | Out-Null
}
npx prisma migrate deploy --config prisma7.config.ts
npx prisma generate --config prisma7.config.ts
npm run start:dev
```

The existing local database was already migrated. Do not reset it. The historical cleanup migration intentionally removes old Condotel business tables; apply this migration history only to the intended simplified project's database.

### 4. Start the frontend

Run inside `frontend`:

```powershell
npm run dev
```

The default page is `http://localhost:5173`; the API base is `http://localhost:3000/api`. [frontend/.env.example](frontend/.env.example) documents the optional `VITE_API_BASE_URL`. It must include `/api`. If the frontend runs on a different origin, update backend `FRONTEND_URL` and restart the backend.

### 5. Sign in and register a device

Use an existing account. There are no hard-coded default credentials. New accounts can be created through the registration API and default to CUSTOMER, not ADMIN. This version has no administrator-promotion screen or seed script. An existing administrator account is required for device registration.

Open **Device Management**, enter a unique device name, and select **Register Door Device**. Save the one-time device ID and secret securely before dismissing the display. Use HTTPS for deployment outside local development because credentials and provisioning secrets travel between the browser and backend.

## Current API

All routes start with `/api`.

| Method and route | Access | Purpose |
| --- | --- | --- |
| `POST /auth/register` | Public | Create an account from email, password, firstName, lastName, and optional username/phone. |
| `POST /auth/login` | Public | Accept identifier and password; return a JWT and safe account details. |
| `GET /auth/me` | Bearer token | Return current account details. |
| `POST /auth/change-password` | Bearer token | Accept currentPassword and newPassword. |
| `GET /devices` | Active administrator without a pending password change | List device metadata. |
| `POST /devices` | Same administrator requirement | Accept deviceName and return metadata plus the generated deviceSecret once. |

Device responses include `Cache-Control: no-store`. Blank or invalid names return 400, duplicate device names return 409, and unusable AES configuration returns 503 before a device record is written.

## Database

- **User:** identity, Argon2id password hash, role, status, login timestamp, password-change flag, and record timestamps.
- **Device:** generated device ID, unique name, encrypted secret fields, and creation timestamp.
- **Prisma migration history:** records applied schema migrations.

There are no current Room, Reservation, Payment, or NFC-card tables. Static frontend examples do not populate SQLite.

## Validation

Run inside `backend`:

```powershell
npm run build
npm run lint
npm test -- --runInBand
npm run test:e2e
```

Run inside `frontend`:

```powershell
npm run build
npm run lint
```

At completion of the device feature, both builds and lint checks passed, along with 36 AES tests and 11 integration tests. Browser checks also covered login, device registration, secret dismissal, persistence after refresh, duplicate-name errors, administrator restrictions, and a 390px mobile viewport.

Integration tests create and remove their own SQLite database inside `backend`; they do not modify real accounts or devices. Node may emit its experimental VM Modules warning during Jest execution.

## Documentation

- [FUNCTIONS_GUIDE.md](FUNCTIONS_GUIDE.md): current source files, functions, configuration, routes, and data flow.
- [CLEANUP.md](CLEANUP.md): historical simplification report. Older sections describe earlier states; use this README and the function guide for current behavior.
