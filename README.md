# Condotel System with NFC Card and Payment

This application uses React/Vite, NestJS, Prisma/SQLite, JWT and Argon2id. User email/phone and reservation special requests are encrypted in the backend using the existing AES-256-GCM EncryptionService.

The starting checkout contained authentication, Device Management and static business pages. Booking, profile updates, guest/user management, checkout and notifications have now been implemented. Existing page layouts and the API properties `email`, `phone` and `specialRequests` are retained.

Device Management has been removed from navigation, routing and backend services. Historical encrypted Device records remain archived; no device API is available.

## Working workflows

- Register, log in by normalized email or username, restore sessions, and change passwords.
- Edit your profile and contacts.
- Staff manage guest contacts and rooms; administrators also manage users, roles, statuses and imports.
- Search exact email/phone values, with partial names/usernames. The committed baseline had no working contact substring search; adding substring indexes requires approval of the tradeoffs in PRIVACY.md.
- Book available dates, include optional special requests and estimated arrival, edit notes, cancel unpaid bookings, and manage reservation status.
- Create a PayMongo hosted checkout and verify signed payment webhooks. Only necessary billing details are decrypted and sent to PayMongo.
- View scoped dashboard data, payments and in-app notifications. PayMongo sends payment email receipts when configured.

Reports, Transactions, Settings and NFC/physical door access remain placeholders. The topbar's general search remains disabled; contact search is in Guests/User Management.

## Setup and existing databases

**Read [PRIVACY.md](PRIVACY.md) before updating any existing database.** Schema deployment alone is insufficient. The server refuses to start until the data migration is finalized, encryption/search keys are valid, and a stored account sample authenticates.

1. Install backend and frontend dependencies using `npm ci` in each directory. On PowerShell with script execution disabled, use `npm.cmd` and `npx.cmd`.
2. Configure backend variables using `backend/.env.example`. Preserve the existing `AES_MASTER_KEY` and `JWT_SECRET`. Add a separate `CONTACT_SEARCH_KEY`.
3. Follow the staged backup, schema expansion, audit, backfill, verify and finalize procedure in [PRIVACY.md](PRIVACY.md). It is required even for an empty fresh installation.
4. Generate the Prisma client with `npx prisma generate --config prisma7.config.ts`.
5. Start the backend with `npm run start:dev`, then the frontend with `npm run dev`.

The backend defaults to port 3000 and the frontend to 5173. `VITE_API_BASE_URL` defaults to `http://localhost:3000/api`. Backend keys must never be placed in frontend variables.

There are no default credentials. Public registration creates CUSTOMER accounts. An operator can provision an initial administrator through the encrypted offline `account:create` command described in the runbook. Managed/provisioned accounts must change their initial password before business operations.

## API

All routes are prefixed with `/api`. Contact/notes responses contain authorized plaintext under the original field names; they never expose ciphertext, IVs, tags, indexes, legacy columns or password hashes.

| Routes | Access and behavior |
| --- | --- |
| POST /auth/register, POST /auth/login | Public account creation/login; Argon2id passwords |
| GET /auth/me, PATCH /auth/me | Own authenticated profile/contact information |
| POST /auth/change-password | Verify current password and hash replacement |
| GET/POST /guests, PATCH /guests/:id | Staff/admin; customer accounts only |
| GET/POST /users, PATCH /users/:id | Admin; role/status changes cannot disable/demote oneself |
| POST /users/import | Admin; up to 50 validated accounts, all-or-nothing |
| GET /rooms | Active account; customers see active rooms |
| POST /rooms, PATCH /rooms/:id | Staff/admin |
| GET/POST /reservations, GET/PATCH /reservations/:id | Owner or staff; staff-only operational status changes |
| GET /dashboard | Scoped reservation/payment data; room occupancy totals |
| GET /payments | Own payments or staff view |
| POST /payments/checkout/:reservationId | Reservation owner or staff |
| POST /payments/:id/reconcile | Admin; verifies matching remote checkout reference/amount |
| POST /payments/webhook/paymongo | Raw-body signature verified, correct mode and fresh timestamp |
| GET /notifications, PATCH /notifications/:id/read | Own notifications only |

Lists of accounts and reservations use `page` (50 records/page). Account lists accept `search`, reservation lists accept `status`. Room lists are capped at 500; payment/notification views show the latest 50.

New reservations take `roomId`, `checkIn`/`checkOut` as YYYY-MM-DD, `adults`, optional `children`, optional `specialRequests`, and optional `estimatedArrival` as HH:mm. Staff may supply `guestId`. Rates and totals are computed server-side. Arrival text is appended to encrypted notes without stripping the submitted requests. Omitting notes on update preserves them; null clears them; the backend also preserves an explicitly empty string.

## Validation

Run in backend:

```powershell
npm run build
npm run lint
npx tsc --noEmit --incremental false
npm test -- --runInBand
npm run test:e2e -- --runInBand
```

Run in frontend:

```powershell
npm run build
npm run lint
```

Tests use random test keys, disposable SQLite databases, real Argon2/JWT, and mocked provider responses. They do not migrate existing customer records or call live PayMongo. Integration tests exercise migration/provisioning/rotation command entrypoints as well as HTTP workflows.

An optional browser smoke test is available as `npm run test:browser` in backend after building the backend. It starts temporary localhost services and a hidden Chromium instance with its own profile/database, and cleans them up afterward. It defaults to the Windows Edge installation; set BROWSER_EXECUTABLE for another Chromium executable. The process must be permitted to start browser renderers. Its mobile screenshot is saved under the ignored backend/.test-artifacts directory.

## Operational limits

PayMongo credentials, allowed payment methods and webhook registration must be configured and tested in the merchant's test account before enabling live checkout. No live provider transaction was made during implementation. Unknown/timeout checkouts are not retried automatically: use the reconciliation flow with the matching PayMongo session ID. Automatic refunds, automatic expiration, and cancellation after checkout creation are not implemented; staff must reconcile payment/refund state before releasing those bookings.

In-app notifications and PayMongo receipts are implemented. No separate booking-email or SMS provider is configured. Account email verification, password recovery and token revocation were not present in the starting app and remain outside this change.

Database schema/data rollout and secret configuration are explicit offline operations, not actions performed at application startup. Production customer records and existing secrets are not modified by tests or builds.

See [PRIVACY.md](PRIVACY.md) for setup, key backup/rotation, migration/collision handling, recovery and search tradeoffs. [FUNCTIONS_GUIDE.md](FUNCTIONS_GUIDE.md) maps the implementation.
