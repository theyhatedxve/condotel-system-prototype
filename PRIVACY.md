# Contact and reservation privacy runbook

## Storage and permission boundaries

EncryptionService uses AES-256-GCM, fresh random 12-byte IVs, 16-byte authentication tags and canonical Base64. Its original context-free API remains compatible with archived device secrets. New contacts use additional authenticated data containing version, user ID and field; notes use version and reservation ID. Moving ciphertext between rows/fields fails authentication. Plaintext is returned only after GCM finalization succeeds.

User fields are emailCiphertext/emailIv/emailAuthTag/emailBlindIndex and the corresponding phone fields. Reservation fields are specialRequestsCiphertext/specialRequestsIv/specialRequestsAuthTag. Optional absent phone/notes use all-null components. Empty reservation text is an authenticated encrypted empty string. Partial envelopes and corrupted values fail with explicit 503 responses, never an empty-string fallback.

JWTs contain only the account ID. Login verifies active status and Argon2 before exposing contacts. The JWT strategy validates the signature and current status before returning the caller's own profile. Business services also require active accounts with no pending password change; they enforce ownership or staff/admin access before decryption. There is no general decrypt endpoint. Trusted offline migration/rotation code may verify entire datasets; online searches never do so.

The legacy email/phone/specialRequests columns exist temporarily for staged migration and are null after finalization. Database triggers reject plaintext writes and incomplete envelopes. Public DTO projections exclude all encryption metadata and legacy fields. No dual writes or plaintext fallback are used.

Reservation notes are excluded from provider requests and notifications. PayMongo receives only billing name/email/optional phone, a non-sensitive payment reference, total and fixed description after reservation authorization. Neither provider response bodies nor raw webhook bodies are saved or logged. In-app notification messages are fixed templates without contact or note values.

Implementation follows Node's [crypto API](https://nodejs.org/api/crypto.html), including authenticated additional data and GCM finalization.

## Identity, lookup and partial search

Email normalization is trim + lowercase, matching the original registration/login DTOs. Phone normalization trims only and maps optional blank input to absence. Punctuation, country prefixes and digits are not rewritten. The previous email uniqueness rule is enforced on the normalized email blind index; phone remains non-unique.

CONTACT_SEARCH_KEY is independent of AES_MASTER_KEY. HMAC-SHA-256 uses domain prefixes `condotel:contact-index:v1:email\0` and `condotel:contact-index:v1:phone\0`. It is not a fixed-IV cipher or unkeyed hash. Rotating the search key requires rebuilding every index offline.

The committed starting guest search was a disabled input over static examples; there was no active contact substring query. The implementation uses exact email/phone plus partial names/usernames. UI help makes that distinction explicit. No approval for contact substring indexing has been assumed; adding it would require approval of the leakage and query limits described below.

Exact indexes leak equality/frequency, while ciphertext leaks approximate length; a database-only attacker without the random search key cannot compute a dictionary of email/phone indexes. Name/username partial matching still operates on plaintext fields outside this request's encryption scope. Combined name/contact search can scan name columns but decrypts at most the authorized 50-row result page. Standalone login email/username lookup uses indexed predicates.

The alternative considered was a separately keyed trigram index, staff-only search, a 3-character minimum and a bounded candidate check. It would leak recurring contact fragments and approximate lengths, enlarge storage/write cost, and sometimes require longer queries when the candidate bound is exceeded. It was not selected and is not implemented. Supporting arbitrary short substrings would increase those privacy/performance costs further.

## Keys: setup and backup

- Preserve the existing AES_MASTER_KEY; do not recreate or overwrite it. It must decode from canonical Base64 to exactly 32 random bytes.
- CONTACT_SEARCH_KEY must be an independent random 32-byte Base64 secret. Identical AES/search keys are rejected.
- Preserve JWT_SECRET independently. PayMongo API/webhook secrets are separate server-only secrets.
- Production: inject keys from the deployment's secret manager. For local development, use the ignored backend .env with OS access restricted to the server operator. Never use VITE_* variables for secrets.
- Generate a missing local search key without printing it with `npm run privacy:init-search-key` inside backend. This command requires an existing .env, preserves a nonempty search key and never changes AES_MASTER_KEY.
- That initializer is for first setup, not recovery of a missing key on an already encrypted database. Restore the original search-key backup in that case.
- Back up both encryption and search keys securely, separately from database backups. Record which secret versions belong to each backup in the external backup inventory, not in application tables.
- Database access alone does not reveal keys. An attacker controlling the application process or both the database and secrets can decrypt data; database encryption does not replace server access controls or HTTPS.
- Do not enable request/body logging, Prisma parameter logging or provider debug-body logging. Use counts and generated record IDs for diagnostics.

No command in this change runs key initialization, rotation or customer-data migration automatically.

## Staged migration

This migration targets the simplified SQLite schema after 20261007020000_register_door_devices. The repository's older 20261007010000_security_demo migration drops historical business tables. **Never apply this entire history to an unsimplified legacy database.** Restore legacy data into an isolated environment and adapt its schema deliberately first. The new Reservation table is empty in this checkout; the data script also handles plaintext notes if approved legacy records are imported into the expanded staging schema.

Prepare a consistent backup and rehearse on an isolated copy with matching backed-up keys. The tests use synthetic/disposable data; they are not a substitute for an operator's restore rehearsal.

1. Stop the backend and every writer/import job. Record the current migration state and application revision.
2. Take a consistent SQLite backup, including any required WAL state, and verify it opens with integrity checks. Securely back up the current keys. Keep the backup outside public/app paths.
3. Configure the separate search key. Preserve the encryption key. Never echo either value.
4. Run the following from backend, substituting the explicit existing SQLite path. The schema command uses DATABASE_URL, while data commands deliberately require a separate path; verify they identify the same offline database.

```powershell
npx prisma migrate deploy --config prisma7.config.ts
npx prisma generate --config prisma7.config.ts
npm run privacy:migrate -- audit "D:/secure/condotel.db"
npm run privacy:migrate -- backfill "D:/secure/condotel.db" --offline-backup-confirmed
npm run privacy:migrate -- verify "D:/secure/condotel.db"
npm run privacy:migrate -- finalize "D:/secure/condotel.db" --offline-backup-confirmed
npm run privacy:migrate -- verify "D:/secure/condotel.db"
```

For a new install, first create an empty database file if it does not already exist; never truncate an existing file. The same finalize step is required for empty databases to install write guards and the email index.

- **Expand:** makes legacy email nullable, preserves all user rows/password hashes, adds encrypted columns and a non-unique staging email index. It creates the newly implemented business tables. Device archives remain intact.
- **Audit:** computes keyed normalized email identities and reports conflicting record IDs before new uniqueness is installed. It never prints contacts. Phone duplicates are allowed.
- **Backfill:** runs under an immediate SQLite transaction with 200-row keyset batches. It reuses EncryptionService, authenticates values read back from storage and compares them to normalized legacy contacts or exact original notes. Existing complete ciphertext is verified, not regenerated. A failure rolls back the phase.
- **Verify:** authenticates every envelope, recomputes indexes and compares remaining plaintext. Tampering, partial data, wrong keys or source divergence stop the phase.
- **Finalize:** repeats audit/verification under the same write lock, clears plaintext only after all rows verify, applies normalized email uniqueness and installs encrypted-only write triggers. A verification/transaction failure rolls back all clearing/constraints. After commit, the CLI checkpoints/truncates WAL, runs VACUUM and checkpoints again to remove old free-page copies. If this separate file cleanup fails, it reports that finalization committed; stay offline, close other connections and repeat finalize.
- Every data phase is repeatable. A crashed transaction rolls back. Resume with audit/backfill/verify; do not delete failed rows or generate replacement keys.

Normalization collisions are deliberately not merged automatically. Review the reported IDs in a secure operator session, establish which account owns the address, and assign a verified distinct address or perform an explicitly approved account merge. Re-run audit. If data was already backfilled, update encrypted fields and index together using the same ContactProtectionService; do not edit only the plaintext copy and then bypass the mismatch check.

After finalization and the CLI's file cleanup, check SQLite foreign-key/integrity results, follow any additional site storage procedure, then verify again before restarting. Database compaction does not erase old backups, filesystem snapshots or SSD remnants. Retire plaintext backups according to the site's retention policy while preserving a tested recovery path.

The server checks finalized protections and validates configured keys against a stored account before accepting requests. It never falls back to legacy contact columns. Keep the application offline until every phase succeeds.

## Key rotation

The supplied rotation command handles users, reservation notes and archived Device secrets in one immediate transaction. It authenticates all old values, re-encrypts with new random IVs, rebuilds keyed indexes and verifies stored replacements before committing. No key material is stored in tables.

1. Stop all writers; take and verify a consistent encrypted backup with its existing key versions.
2. Rehearse on a disposable copy. Set NEXT_AES_MASTER_KEY and NEXT_CONTACT_SEARCH_KEY in the offline process environment from the secret manager. Use independent 32-byte Base64 keys. To rotate only one secret, set the other NEXT value to its current value.
3. Run `npm run privacy:rotate -- "D:/secure/condotel.db" --offline-backup-confirmed`.
4. After success, activate the NEXT values as AES_MASTER_KEY and CONTACT_SEARCH_KEY in backend configuration; remove temporary NEXT variables. The tool deliberately does not rewrite deployment secrets.
5. Run migration verify with the new keys, checkpoint/compact according to storage policy, restart and test login, lookup, contact updates and reservation notes.
6. Preserve old keys with old backups. Do not discard keys still needed to restore retained archives.

If rotation reports failure, its database transaction rolled back; keep the old active keys. If the process ends after commit but before confirmation/configuration activation, remain offline and run verify separately with the current and proposed key pairs to establish which complete set authenticates. Never alternate keys against a live mixed deployment.

## Recovery and provisioning

Missing keys: restore the exact backed-up keys and re-run verify. Lost AES key means the ciphertext cannot be recovered from the database. Lost search key can be replaced only through offline reindexing/rotation while the encryption key is available; the standard rotation tool expects both old keys for verification, so first recover the search-key backup. Do not improvise online fallback scans.

Tampering or verification mismatch: preserve the failed database for investigation, restore a known-good backup and its matching key versions, and verify on an isolated copy. Do not clear ciphertext or convert failures to empty notes. A pre-migration restore also requires restoring the compatible application revision and following the migration again before restarting the encrypted application.

For a fresh administrator or controlled seed, pipe one validated JSON account object into:
`npm run account:create -- "D:/secure/condotel.db" --operator-provisioning`.
The object uses email, password, firstName, lastName and optional username, phone, role. Obtain it from a secure input source; do not put real passwords in shell arguments/history or committed seed files. The command validates DTOs, requires finalized migration, hashes with Argon2id, encrypts contacts and prints only the generated account ID. It does not overwrite or upsert an existing identity. Use the required password-change flow after login.

For subsequent imports, the admin endpoint POST /users/import accepts `{ users: [...] }`, up to 50 accounts per atomic batch. All contacts are encrypted and passwords hashed before insertion. A conflicting row rolls back the whole batch.

## PayMongo activation and recovery

Configure PAYMONGO_SECRET_KEY, PAYMONGO_WEBHOOK_SECRET, PAYMONGO_PAYMENT_METHODS and FRONTEND_URL in backend secrets/configuration. Use an HTTPS return URL for live mode; test keys permit localhost. Follow the official [Hosted Checkout guide](https://docs.paymongo.com/docs/payment-channels-hosted-checkout) and [webhook signing guide](https://docs.paymongo.com/docs/developer-tools-webhook-setup-management).

Register POST /api/payments/webhook/paymongo for checkout_session.payment.paid. The handler checks the raw-body HMAC signature, test/live mode, a five-minute timestamp window, checkout reference, amount and currency. Replayed valid paid events do not duplicate fulfillment/notifications. Browser return URLs never mark reservations paid. Merchant webhook retries must use a fresh signed timestamp or be reconciled by an administrator.

The adapter uses v2 checkout creation, fixed server-computed PHP amounts and PayMongo email receipts. Provider billing is necessarily plaintext at the provider boundary. Confirm provider-side data handling separately; the local application does not store copied billing payloads.

The payment row is created before the network call. Timeouts/ambiguous responses leave UNKNOWN, preventing duplicate checkout attempts. Staff can look up the session by its payment reference in PayMongo, then an administrator uses Payments > Reconcile checkout or POST /payments/:id/reconcile with sessionId. The server retrieves and verifies that session. If no remote session exists, retain the row and investigate through the operator workflow; automatic reset/retry is intentionally unavailable. Refunds and cancellation of a booking with any checkout require manual reconciliation and are not exposed as automatic actions.

Test with the merchant's PayMongo test account before live enablement. Automated tests mock provider HTTP responses and signed events; they do not establish that merchant credentials, payment methods or public webhook delivery are configured.
