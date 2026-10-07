# MINIMAL CONDOTEL CLEANUP COMPLETE

Feature addition: administrator-only door-device registration now uses the existing AES service to encrypt generated device secrets. A Device table, registration/list endpoints and Device Management page were added. The backend master key is configured privately in the ignored .env. Earlier cleanup notes below are historical.

Later UI update: User Management, Payments, Transactions, Reports and Settings now use the same shared placeholder as NFC Management. Their five page components and dedicated styles were removed. The informational preview banner was also removed. The My Profile page, route, menu item and page-specific styles were subsequently removed. Change Password remains available; its removal was reverted. Current source counts: backend 12, frontend 24, total 36. The original cleanup report below records the earlier state and its validation.

## 1. Original source file count

| Scope | Meaningful code/CSS files | All source-directory entries |
| --- | ---: | ---: |
| Backend | 76 | 76 |
| Frontend | 64 | 67 |
| Total | 140 | 143 |

The extra three frontend entries were unused image assets. Counts describe the working tree at the start of this cleanup, not Git HEAD (which already contained an earlier reduction). Generated Prisma code, dependencies, builds, configuration, migrations, documentation and the integration test outside src are excluded.

## 2. Final source file count

| Scope | Files |
| --- | ---: |
| Backend | 12 |
| Frontend | 30 |
| Total | 42 |

The AES test inside src is counted. One additional authentication test remains under backend/test. The 20-30 target was flexible: retaining distinct original page layouts and readable authentication boundaries justified 42. Ten page stylesheets were consolidated, room-card JSX was inlined, date/currency helpers were merged, and small authentication wrappers were consolidated. Further substantial reduction would combine unrelated pages or flatten useful module boundaries.

## 3. Features kept

Existing React visual identity, sidebar, topbar, cards, tables, disabled forms/actions, payment/transaction viewing dialogs, login and change-password screens, profile identity and PlaceholderPage. NestJS/Prisma/SQLite authentication, registration, Argon2id password hashing/verification, JWT/session restoration/logout, active-account checks and password-change requirements remain real. AES-256-GCM remains independently testable in SecurityModule.

## 4. Features removed

Guest management; room management; reservation availability/creation/status changes; check-in/out processing; payment processing and PayMongo; transactions; reports/export; notifications/polling; search; settings persistence; user administration/reset-password operations; dashboard backend statistics and guest/occupancy calculations. NFC, devices/ESP32 and access-control persistence/models were removed; their presentation placeholders remain. No fake CRUD, mock backend or business localStorage was introduced. Old payment callback pages and role-only routing were removed. Health and starter application endpoints were unnecessary and removed.

## 5. Backend files kept

Paths relative to backend/src (generated Prisma output excluded):

```text
app.module.ts
auth/auth.controller.ts
auth/auth.dto.ts
auth/auth.module.ts
auth/auth.service.ts
auth/jwt.strategy.ts
main.ts
prisma/prisma.module.ts
prisma/prisma.service.ts
security/encryption.service.spec.ts
security/encryption.service.ts
security/security.module.ts
```

## 6. Frontend files kept

Paths relative to frontend/src:

```text
features/auth/AuthContext.jsx
features/auth/ChangePasswordPage.jsx
features/auth/LoginPage.jsx
features/auth/ProfilePage.jsx
features/auth/auth.css
features/auth/authApi.js
features/auth/authStorage.js
features/auth/useAuth.js
features/dashboard/DashboardPage.jsx
features/guests/GuestsPage.jsx
features/nfc/PlaceholderPage.jsx
features/payments/PaymentsPage.jsx
features/reports/ReportsPage.jsx
features/reservations/ReservationsPage.jsx
features/rooms/RoomsPage.jsx
features/settings/SettingsPage.jsx
features/transactions/TransactionsPage.jsx
features/user-management/UserManagementPage.jsx
layouts/AdminLayout.jsx
layouts/Sidebar.jsx
layouts/Topbar.jsx
layouts/layout.css
main.jsx
routes/AppRoutes.jsx
routes/ProtectedRoute.jsx
services/apiClient.js
styles/global.css
styles/presentation.css
styles/variables.css
utils/format.js
```

## 7. Files deleted

105 original source/asset paths were deleted. Some responsibilities moved into consolidated files: authentication DTOs/guard/types, context/loading wrapper, room cards, helpers and page styles. These deletions do not imply deletion of the corresponding retained UI. Exact paths grouped by feature follow.

### backend / application

- `backend/src/app.controller.spec.ts`
- `backend/src/app.controller.ts`
- `backend/src/app.service.ts`

### backend / auth

- `backend/src/auth/decorators/current-user.decorator.ts`
- `backend/src/auth/decorators/roles.decorator.ts`
- `backend/src/auth/dto/change-password.dto.ts`
- `backend/src/auth/dto/login.dto.ts`
- `backend/src/auth/dto/register.dto.ts`
- `backend/src/auth/dto/update-profile.dto.ts`
- `backend/src/auth/guards/jwt-auth.guard.ts`
- `backend/src/auth/guards/roles.guard.ts`
- `backend/src/auth/interfaces/authenticated-user.interface.ts`
- `backend/src/auth/interfaces/jwt-payload.interface.ts`
- `backend/src/auth/strategies/jwt-auth.guard.ts`
- `backend/src/auth/strategies/jwt.strategy.ts`

### backend / guests

- `backend/src/guests/create-guest.dto.ts`
- `backend/src/guests/guests.controller.ts`
- `backend/src/guests/guests.module.ts`
- `backend/src/guests/guests.service.ts`
- `backend/src/guests/update-guest.dto.ts`

### backend / health

- `backend/src/health/health.controller.ts`
- `backend/src/health/health.module.ts`

### backend / notifications

- `backend/src/notifications/notifications.controller.ts`
- `backend/src/notifications/notifications.module.ts`
- `backend/src/notifications/notifications.service.ts`

### backend / payments

- `backend/src/payments/payments.controller.ts`
- `backend/src/payments/payments.module.ts`
- `backend/src/payments/payments.service.ts`
- `backend/src/payments/paymongo.interface.ts`
- `backend/src/payments/paymongo.service.ts`

### backend / reports

- `backend/src/reports/report-range-query.dto.ts`
- `backend/src/reports/reports.controller.ts`
- `backend/src/reports/reports.module.ts`
- `backend/src/reports/reports.service.ts`

### backend / reservations

- `backend/src/reservations/availability-query.dto.ts`
- `backend/src/reservations/create-reservation.dto.ts`
- `backend/src/reservations/reservation-query.dto.ts`
- `backend/src/reservations/reservations.controller.ts`
- `backend/src/reservations/reservations.module.ts`
- `backend/src/reservations/reservations.service.ts`
- `backend/src/reservations/update-reservation-status.dto.ts`

### backend / rooms

- `backend/src/rooms/create-room.dto.ts`
- `backend/src/rooms/rooms.controller.ts`
- `backend/src/rooms/rooms.module.ts`
- `backend/src/rooms/rooms.service.ts`
- `backend/src/rooms/update-room-status.dto.ts`
- `backend/src/rooms/update-room.dto.ts`

### backend / search

- `backend/src/search/search-query.dto.ts`
- `backend/src/search/search.controller.ts`
- `backend/src/search/search.module.ts`
- `backend/src/search/search.service.ts`

### backend / settings

- `backend/src/settings/settings.controller.ts`
- `backend/src/settings/settings.module.ts`
- `backend/src/settings/settings.service.ts`
- `backend/src/settings/update-settings.dto.ts`

### backend / transactions

- `backend/src/transactions/transactions.controller.ts`
- `backend/src/transactions/transactions.module.ts`
- `backend/src/transactions/transactions.service.ts`

### backend / user-management

- `backend/src/user-management/reset-user-password.dto.ts`
- `backend/src/user-management/update-managed-user.dto.ts`
- `backend/src/user-management/user-management-query.dto.ts`
- `backend/src/user-management/user-management.controller.ts`
- `backend/src/user-management/user-management.module.ts`
- `backend/src/user-management/user-management.service.ts`

### backend / users

- `backend/src/users/users.module.ts`
- `backend/src/users/users.service.ts`

### frontend / application

- `frontend/src/App.css`
- `frontend/src/App.jsx`
- `frontend/src/index.css`

### frontend / assets

- `frontend/src/assets/hero.png`
- `frontend/src/assets/react.svg`
- `frontend/src/assets/vite.svg`

### frontend / auth

- `frontend/src/features/auth/auth-context.js`
- `frontend/src/features/auth/LoadingScreen.jsx`
- `frontend/src/features/auth/profile.css`

### frontend / dashboard

- `frontend/src/features/dashboard/dashboard.css`

### frontend / guests

- `frontend/src/features/guests/guestApi.js`
- `frontend/src/features/guests/GuestFormModal.jsx`
- `frontend/src/features/guests/guests.css`

### frontend / notifications

- `frontend/src/features/notifications/notificationApi.js`

### frontend / payments

- `frontend/src/features/payments/payment-result.css`
- `frontend/src/features/payments/paymentApi.js`
- `frontend/src/features/payments/PaymentResultPage.jsx`
- `frontend/src/features/payments/payments.css`

### frontend / reports

- `frontend/src/features/reports/reportApi.js`
- `frontend/src/features/reports/reports.css`

### frontend / reservations

- `frontend/src/features/reservations/reservationApi.js`
- `frontend/src/features/reservations/ReservationFormModal.jsx`
- `frontend/src/features/reservations/reservations.css`

### frontend / rooms

- `frontend/src/features/rooms/roomApi.js`
- `frontend/src/features/rooms/RoomCard.jsx`
- `frontend/src/features/rooms/RoomFormModal.jsx`
- `frontend/src/features/rooms/rooms.css`

### frontend / search

- `frontend/src/features/search/searchApi.js`

### frontend / settings

- `frontend/src/features/settings/settings.css`
- `frontend/src/features/settings/settingsApi.js`

### frontend / transactions

- `frontend/src/features/transactions/transactionApi.js`
- `frontend/src/features/transactions/transactions.css`

### frontend / user-management

- `frontend/src/features/user-management/user-management.css`
- `frontend/src/features/user-management/userManagementApi.js`

### frontend / pages

- `frontend/src/pages/shared/NotFoundPage.jsx`
- `frontend/src/pages/shared/UnauthorizedPage.jsx`

### frontend / styles

- `frontend/src/styles/prodile.css`

### frontend / utils

- `frontend/src/utils/formatCurrency.js`
- `frontend/src/utils/formatDate.js`

Additional unused files removed: backend/README.md and frontend/README.md (generic framework templates, replaced by the root setup guide), and frontend/public/icons.svg. Empty feature directories were removed. Temporary inventory, screenshots, browser profiles and isolated browser databases were removed after validation.

## 8. Files converted to UI-only

DashboardPage.jsx, GuestsPage.jsx, RoomsPage.jsx, ReservationsPage.jsx, PaymentsPage.jsx, TransactionsPage.jsx, ReportsPage.jsx, SettingsPage.jsx and UserManagementPage.jsx now use small local presentation constants. ProfilePage.jsx is read-only and displays the real authenticated identity. Sidebar navigation remains; Topbar retains its appearance and functional account menu while search and notifications are disabled. PlaceholderPage.jsx remains for NFC/devices and unmatched routes. LoginPage.jsx and ChangePasswordPage.jsx remain functional authentication screens.

## 9. Prisma changes

Retained only User, UserRole and UserStatus. User preserves credential/identity fields, phone for profile display, account status/role, last-login timestamp, mustChangePassword and creation/update timestamps. Removed GuestProfile, Room, Reservation, Payment, Transaction, NfcCard, NfcAssignment, Device, AccessLog, AuditLog, SystemSetting and Notification.

Applied migration 20261007010000_security_demo with migrate deploy; regenerated Prisma Client. No reset was performed. Business tables/data were intentionally dropped in this duplicate. All eight User rows, including their password hashes and timestamps, were unchanged (verified with a full-row fingerprint). Database now contains only User and Prisma migration history. All five historical migrations are retained for reproducible setup and upgrade compatibility. Prisma reports the database is up to date.

## 10. Dependencies removed

Backend: @nestjs/mapped-types, @nestjs/observe and the development deployment package @nestjs/mau; its unused deployment script was removed. package.json/package-lock.json agree. No PayMongo npm SDK was installed; its HTTP integration code was removed. Frontend dependencies remain in use. No new dependencies were added. Existing installed node_modules were not manually edited.

## 11. AES verification

Preserved the existing executable EncryptionService implementation: AES-256-GCM, exactly 32 decoded master-key bytes, random 12-byte IV per encryption, 16-byte GCM tag, canonical Base64 ciphertext/IV/tag, authentication of ciphertext during decryption and strict key/payload validation. All 36 AES tests pass, including round trips, Unicode/empty text, IV uniqueness, wrong keys, tampered payloads and malformed encodings/lengths. No security HTTP controller is required. AES_MASTER_KEY stays backend-only; no secret was printed or added to source/frontend storage.

## 12. Argon2id verification

Registration and password changes call argon2.hash with argon2.argon2id. Login/current-password verification uses argon2.verify. The integration suite verifies stored hashes, successful verification, bad credentials and old/new password behavior after a change. Authentication responses exclude passwordHash. Existing account hashes remain intact.

## 13. Authentication verification

All eight isolated SQLite integration tests pass. They cover registration/validation, duplicate accounts, login/status checks, signed JWT identity, missing/expired/forged tokens, password-change flags and password changes, and removal of business endpoints. Browser checks pass for protected redirects, real login, session restoration, profile, password change, login with the new password, remember-me storage and logout clearing storage.

Browser navigation tested every sidebar page, NFC placeholder, room cards and payment/transaction dialogs, disabled settings/profile controls, desktop rendering and 390px mobile rendering without page overflow. No runtime exceptions or failed HTTP requests occurred. Browser traffic contained only /api/auth/login, /api/auth/me and /api/auth/change-password; no removed business endpoint was called.

## 14. Frontend build result

npm run build: PASS. npm run lint: PASS.

## 15. Backend build result

npm run build: PASS. npm run lint: PASS. npm test: 36 PASS. npm run test:e2e: 8 PASS. prisma migrate deploy, generate and migrate status: PASS.

## 16. Remaining warnings

- AES_MASTER_KEY is unset in the existing backend .env. Configure a private 32-byte Base64 key before invoking the service manually. Tests use isolated random keys and pass independently. Local .env files and their existing secret values were left unchanged; obsolete variables are no longer read or documented as required configuration.
- Jest emits Node's existing experimental VM Modules warning; tests pass.
- Source count is 42 to preserve distinct layouts and maintainability. Configuration, migration history and generated Prisma output are necessary supporting infrastructure and excluded from that count.
- Business data in this duplicate was removed by the migration; all eight authentication records were preserved. No original external workspace was accessed or modified. Nothing was committed or pushed.
