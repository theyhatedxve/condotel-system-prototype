# Implementation guide

Use [README.md](README.md) for workflows and [PRIVACY.md](PRIVACY.md) for key setup, migration, recovery and provider configuration. CLEANUP.md is historical.

## Backend boundaries

| File/folder | Responsibility |
| --- | --- |
| src/main.ts | Validation, CORS, raw webhook bodies, no-store responses and startup |
| src/app.module.ts / business.module.ts | Module composition; sanitized ORM error filter; privacy readiness |
| src/auth | Registration, Argon2id login/password changes, JWT signature/status checks and explicit user response projection |
| src/security/encryption.service.ts | Existing AES-256-GCM service; optional AAD; domain-separated HMAC blind indexes |
| src/security/contact-protection.service.ts | Contact normalization, envelope writes, index verification and authorized contact reads |
| src/security/reservation-notes.service.ts | Optional encrypted notes; exact-text preservation; authorization before decryption |
| src/security/access.ts | Active-account, staff, admin and owner-or-staff checks |
| src/security/privacy-readiness.service.ts | Refuse startup until the migration is finalized; validate keys against a stored account |
| src/security/privacy-migration.ts | Repeatable audit/backfill/verify/finalize with transactional verification before clearing plaintext |
| src/security/privacy-rotation.ts | Offline atomic re-encryption/reindexing, including Device archives |
| src/users | Scoped paginated management/search, self-profile edits and atomic encrypted imports |
| src/reservations | Rooms, scoped booking CRUD, server totals, overlap checks, note/arrival handling and dashboard |
| src/payments | Authorized billing-only decryption, PayMongo adapter, signature validation, idempotent payment fulfillment and reconciliation |
| src/notifications | Fixed-template in-app notifications, owner-only listing/read marking |
| src/prisma | Shared Prisma client and SQLite adapter |

Contact serializers are allowlists. No controller returns raw User or Reservation rows. Customer reservation queries are scoped by guestId before serialization; staff access is checked again when decrypting contacts/notes. Login's email/username lookup uses blindIndex/username predicates and does not decrypt unverified accounts.

Business operations are unavailable while mustChangePassword is true. Password-change and own profile/session retrieval remain available to complete the initial account flow.

## Database and scripts

Prisma contains User, Room, Reservation, Payment, Notification and a retained Device archive. Device Management controllers/services and frontend files are removed. Existing migration history is unchanged; the new expansion migration preserves user state and reintroduces business tables for the newly requested workflows.

The Prisma schema describes the finalized unique email blind index. Expansion temporarily uses a non-unique staging index; privacy:migrate finalize installs the final unique index and write-protection triggers after collision checks. Do not use db push to bypass this staged process.

- privacy:init-search-key: initialize only a missing local search key; preserve AES and nonempty search keys.
- privacy:migrate: run a named phase against an explicit existing database path.
- privacy:rotate: rotate/reindex all encrypted data offline using current and NEXT secrets.
- account:create: validate stdin account data, Argon2id-hash its password and encrypt contacts; intended for operator provisioning/seeds.

No hardcoded users, passwords, keys or plaintext seed records are supplied.

## Frontend

The original navigation shell, tables/cards and CSS are retained. Shared WorkflowForm/WorkflowDialog components supply the previously missing create/edit forms. useResource loads authenticated data into memory, cancels obsolete requests and exposes refresh/error state.

- Auth: login, register, change password, protected routes and token/session state.
- GuestsPage: staff guest management or administrator user management, exact contact search and imports.
- ProfilePage: own contact/name editing followed by session refresh.
- RoomsPage: room list, staff create/edit/activation and status filtering.
- ReservationsPage: scoped table, pagination, booking, notes/arrival editing, status actions and checkout redirect.
- PaymentsPage: scoped payment status and administrator provider reconciliation.
- DashboardPage: actual scoped statistics and recent reservations.
- Topbar: own notifications and profile/password menu.
- Existing unrelated Reports/Transactions/Settings/NFC placeholder pages remain.

API field names email, phone and specialRequests stay unchanged. Encryption keys and cryptographic operations are not shipped to the frontend.

## Verification

Encryption tests cover independent AES round trips, randomness, Base64/key validation, tampering and additional-data binding. Contact/notes tests cover keyed index behavior, absent/empty values and permission failures before decryption. SQLite migration tests cover collision detection, repeatability, authentication-before-clearing, encrypted-only write guards, uniqueness and rotation rollback.

HTTP integration tests use real SQLite, Argon2 and JWT for account creation/login/updates, staff lookup/imports, booking/notes/access denial, necessary checkout billing, payment webhook fulfillment and notification isolation. Separate command tests exercise migration, provisioning and rotation entrypoints on disposable files. No live customer database is migrated by these checks.
