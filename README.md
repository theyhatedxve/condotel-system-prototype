# Condotel Security Prototype

A reduced demonstration of the **Condotel System with NFC Card and Payment** project. The existing Condotel interface now demonstrates real authentication and AES encryption. Reservation, payment, NFC/device management and other business workflows have been removed.

The application has 33 source files under `backend/src` and `frontend/src` (including CSS and the AES tests, excluding generated Prisma code), plus one integration test in `backend/test`.

## Run locally

Use Node.js 24 and npm. Run commands from this project directory, which contains `backend` and `frontend`.

1. In `backend`, run `npm ci`.
2. For a fresh checkout, copy `.env.example` to `.env`. Preserve an existing local `.env`.
3. Set separate random values for `JWT_SECRET` and `AES_MASTER_KEY` in **backend/.env**. Generate each independently:

   ```powershell
   node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
   ```

   AES_MASTER_KEY must be canonical Base64 encoding of exactly 32 bytes. Never place it in frontend environment variables or source. The supplied example contains no secrets. Login can run without AES configured; encryption returns a configuration error until the key is set.

4. From `backend`, apply migrations and generate Prisma:

   ```powershell
   # Create only a missing, empty SQLite file; never overwrite an existing database.
   if (-not (Test-Path -LiteralPath 'prisma/dev.db')) {
     New-Item -ItemType File -Path 'prisma/dev.db' | Out-Null
   }
   npx prisma migrate deploy --config prisma7.config.ts
   npx prisma generate --config prisma7.config.ts
   npm run start:dev
   ```

   This assumes the example DATABASE_URL, `file:./prisma/dev.db`. The explicit empty-file creation supports the installed SQLite schema engine. Existing accounts survive the reduction migration; no reset is needed.

5. In a second terminal, from `frontend`:

   ```powershell
   npm ci
   npm run dev
   ```

   Open http://localhost:5173. The API defaults to http://localhost:3000/api. Optional `frontend/.env` configuration is documented in `.env.example`. If changing the frontend origin, also update backend `FRONTEND_URL`.

## Sign in

Use an existing account's email/username and password. All eight accounts in this duplicated development database were preserved, including their Argon2id hashes.

A fresh database can create one demo account through the retained registration endpoint. With the backend running, enter your own password at the prompt; no default password is embedded in source:

```powershell
$demoEmail = Read-Host 'Demo email'
$demoSecurePassword = Read-Host 'Demo password (8-128 characters)' -AsSecureString
$demoCredential = [System.Net.NetworkCredential]::new('', $demoSecurePassword)
$demoBody = @{
  email = $demoEmail
  password = $demoCredential.Password
  firstName = 'Demo'
  lastName = 'User'
} | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri 'http://localhost:3000/api/auth/register' -ContentType 'application/json' -Body $demoBody | Out-Null
Remove-Variable demoBody, demoCredential, demoSecurePassword
```

Registration uses the existing CUSTOMER role default. All active roles access the same demonstration dashboard; there is no role management. Accounts marked for a temporary-password change must change it in Account before accessing the AES demo.

## Demonstration

1. Sign in. NestJS verifies the stored Argon2id hash and issues a signed JWT.
2. The protected Condotel dashboard displays the original sidebar, topbar, theme and informational cards.
3. Enter sample text and choose **Encrypt text**. The server returns Base64 ciphertext, a fresh 12-byte IV and a 16-byte authentication tag.
4. Choose **Decrypt text** to recover the original UTF-8 text.
5. Change a ciphertext, IV or tag value and decrypt again. Authentication fails without returning plaintext. Encrypt again to restore a valid set.
6. Change a password in Account to demonstrate creation of a new Argon2id hash.
7. Sign out to clear the browser's session. Remember me uses localStorage; otherwise the JWT uses sessionStorage.

The AES master key never leaves the backend. Demo inputs and outputs are not stored in SQLite. Changing the master key makes previous ciphertext undecryptable. JWTs expire after the configured lifetime (default one hour). Sign-out clears browser storage; this minimal stateless implementation does not maintain a server-side token revocation list.

## API

All routes have the `/api` prefix.

| Method | Route | Access |
| --- | --- | --- |
| POST | /auth/register | Public; creates a normal account |
| POST | /auth/login | Public; Argon2id verification |
| GET | /auth/me | JWT required |
| POST | /auth/change-password | JWT and current password required |
| POST | /security/encrypt-demo | JWT; temporary password must be changed |
| POST | /security/decrypt-demo | JWT; temporary password must be changed |

Encryption body: `{ "text": "Example" }` (maximum 4,096 characters). Decryption body contains `ciphertext`, `iv` and `authTag`. Unknown fields and invalid input are rejected.

## Checks

From `backend`:

```powershell
npm run build
npm test -- --runInBand
npm run test:e2e -- --runInBand
npm run lint
```

From `frontend`:

```powershell
npm run build
npm run lint
```

The 36 AES unit tests cover round trips, key/IV/tag validation, randomness and tamper rejection. The 15 integration tests run the actual NestJS routes, Prisma/SQLite, Argon2id and JWT against a temporary database inside `backend`; they clean it up afterward and never alter the development accounts.

## Database and source

`User` is the only application model. Role/status fields remain for account compatibility. Migration history is retained so existing copies can be upgraded without resetting accounts; historical migrations reference the removed models, but the final schema and running application do not.

`backend/src/auth` handles account creation, login, password changes and JWT validation. `backend/src/security` contains the unchanged AES algorithm and the two demo endpoints. `backend/src/prisma` supplies the SQLite client.

`frontend/src/features/auth` handles login and session state. `frontend/src/features/dashboard` contains the AES and account demonstration. Shared layout, routing, API client and styles retain the Condotel appearance.
