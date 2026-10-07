# Condotel security demonstration cleanup report

Completed in the duplicated workspace only. No commit or push was made. Pre-existing deletions under backend/.claude and backend/.windsurf were left untouched and are excluded from this report.

## Purpose and file counts

The project now demonstrates AES-256-GCM, Argon2id password hashing, real JWT authentication and the existing Condotel UI. Business workflows have been removed.

| Source tree | Files |
| --- | ---: |
| backend/src | 14 |
| frontend/src | 19 |
| Combined | **33** |

Counts include CSS and the AES unit test, but exclude generated Prisma code, dependencies, builds, package files and migrations. The integration test in backend/test adds one meaningful test file (34 including it). Separate context/hook files support React Fast Refresh; authentication, cryptography and database modules remain distinct.

## Deleted files

114 old source/asset paths were removed: 106 obsolete paths and 8 whose required behavior was merged or relocated. Required UsersService logic moved into AuthService; authentication DTOs and JWT files were consolidated.

### backend/src (root) (3)

- `backend/src/app.controller.spec.ts`
- `backend/src/app.controller.ts`
- `backend/src/app.service.ts`

### backend/src/auth (12)

- `backend/src/auth/decorators/current-user.decorator.ts`
- `backend/src/auth/decorators/roles.decorator.ts`
- `backend/src/auth/dto/change-password.dto.ts` - merged or relocated
- `backend/src/auth/dto/login.dto.ts` - merged or relocated
- `backend/src/auth/dto/register.dto.ts` - merged or relocated
- `backend/src/auth/dto/update-profile.dto.ts`
- `backend/src/auth/guards/jwt-auth.guard.ts` - merged or relocated
- `backend/src/auth/guards/roles.guard.ts`
- `backend/src/auth/interfaces/authenticated-user.interface.ts` - merged or relocated
- `backend/src/auth/interfaces/jwt-payload.interface.ts` - merged or relocated
- `backend/src/auth/strategies/jwt-auth.guard.ts`
- `backend/src/auth/strategies/jwt.strategy.ts` - merged or relocated

### backend/src/guests (5)

- `backend/src/guests/create-guest.dto.ts`
- `backend/src/guests/guests.controller.ts`
- `backend/src/guests/guests.module.ts`
- `backend/src/guests/guests.service.ts`
- `backend/src/guests/update-guest.dto.ts`

### backend/src/health (2)

- `backend/src/health/health.controller.ts`
- `backend/src/health/health.module.ts`

### backend/src/notifications (3)

- `backend/src/notifications/notifications.controller.ts`
- `backend/src/notifications/notifications.module.ts`
- `backend/src/notifications/notifications.service.ts`

### backend/src/payments (5)

- `backend/src/payments/payments.controller.ts`
- `backend/src/payments/payments.module.ts`
- `backend/src/payments/payments.service.ts`
- `backend/src/payments/paymongo.interface.ts`
- `backend/src/payments/paymongo.service.ts`

### backend/src/reports (4)

- `backend/src/reports/report-range-query.dto.ts`
- `backend/src/reports/reports.controller.ts`
- `backend/src/reports/reports.module.ts`
- `backend/src/reports/reports.service.ts`

### backend/src/reservations (7)

- `backend/src/reservations/availability-query.dto.ts`
- `backend/src/reservations/create-reservation.dto.ts`
- `backend/src/reservations/reservation-query.dto.ts`
- `backend/src/reservations/reservations.controller.ts`
- `backend/src/reservations/reservations.module.ts`
- `backend/src/reservations/reservations.service.ts`
- `backend/src/reservations/update-reservation-status.dto.ts`

### backend/src/rooms (6)

- `backend/src/rooms/create-room.dto.ts`
- `backend/src/rooms/rooms.controller.ts`
- `backend/src/rooms/rooms.module.ts`
- `backend/src/rooms/rooms.service.ts`
- `backend/src/rooms/update-room-status.dto.ts`
- `backend/src/rooms/update-room.dto.ts`

### backend/src/search (4)

- `backend/src/search/search-query.dto.ts`
- `backend/src/search/search.controller.ts`
- `backend/src/search/search.module.ts`
- `backend/src/search/search.service.ts`

### backend/src/settings (4)

- `backend/src/settings/settings.controller.ts`
- `backend/src/settings/settings.module.ts`
- `backend/src/settings/settings.service.ts`
- `backend/src/settings/update-settings.dto.ts`

### backend/src/transactions (3)

- `backend/src/transactions/transactions.controller.ts`
- `backend/src/transactions/transactions.module.ts`
- `backend/src/transactions/transactions.service.ts`

### backend/src/user-management (6)

- `backend/src/user-management/reset-user-password.dto.ts`
- `backend/src/user-management/update-managed-user.dto.ts`
- `backend/src/user-management/user-management-query.dto.ts`
- `backend/src/user-management/user-management.controller.ts`
- `backend/src/user-management/user-management.module.ts`
- `backend/src/user-management/user-management.service.ts`

### backend/src/users (2)

- `backend/src/users/users.module.ts`
- `backend/src/users/users.service.ts` - merged or relocated

### frontend/src (root) (3)

- `frontend/src/App.css`
- `frontend/src/App.jsx`
- `frontend/src/index.css`

### frontend/src/assets (3)

- `frontend/src/assets/hero.png`
- `frontend/src/assets/react.svg`
- `frontend/src/assets/vite.svg`

### frontend/src/features/auth (4)

- `frontend/src/features/auth/ChangePasswordPage.jsx`
- `frontend/src/features/auth/LoadingScreen.jsx`
- `frontend/src/features/auth/profile.css`
- `frontend/src/features/auth/ProfilePage.jsx`

### frontend/src/features/guests (4)

- `frontend/src/features/guests/guestApi.js`
- `frontend/src/features/guests/GuestFormModal.jsx`
- `frontend/src/features/guests/guests.css`
- `frontend/src/features/guests/GuestsPage.jsx`

### frontend/src/features/nfc (1)

- `frontend/src/features/nfc/PlaceholderPage.jsx`

### frontend/src/features/notifications (1)

- `frontend/src/features/notifications/notificationApi.js`

### frontend/src/features/payments (5)

- `frontend/src/features/payments/payment-result.css`
- `frontend/src/features/payments/paymentApi.js`
- `frontend/src/features/payments/PaymentResultPage.jsx`
- `frontend/src/features/payments/payments.css`
- `frontend/src/features/payments/PaymentsPage.jsx`

### frontend/src/features/reports (3)

- `frontend/src/features/reports/reportApi.js`
- `frontend/src/features/reports/reports.css`
- `frontend/src/features/reports/ReportsPage.jsx`

### frontend/src/features/reservations (4)

- `frontend/src/features/reservations/reservationApi.js`
- `frontend/src/features/reservations/ReservationFormModal.jsx`
- `frontend/src/features/reservations/reservations.css`
- `frontend/src/features/reservations/ReservationsPage.jsx`

### frontend/src/features/rooms (5)

- `frontend/src/features/rooms/roomApi.js`
- `frontend/src/features/rooms/RoomCard.jsx`
- `frontend/src/features/rooms/RoomFormModal.jsx`
- `frontend/src/features/rooms/rooms.css`
- `frontend/src/features/rooms/RoomsPage.jsx`

### frontend/src/features/search (1)

- `frontend/src/features/search/searchApi.js`

### frontend/src/features/settings (3)

- `frontend/src/features/settings/settings.css`
- `frontend/src/features/settings/settingsApi.js`
- `frontend/src/features/settings/SettingsPage.jsx`

### frontend/src/features/transactions (3)

- `frontend/src/features/transactions/transactionApi.js`
- `frontend/src/features/transactions/transactions.css`
- `frontend/src/features/transactions/TransactionsPage.jsx`

### frontend/src/features/user-management (3)

- `frontend/src/features/user-management/user-management.css`
- `frontend/src/features/user-management/userManagementApi.js`
- `frontend/src/features/user-management/UserManagementPage.jsx`

### frontend/src/pages (2)

- `frontend/src/pages/shared/NotFoundPage.jsx`
- `frontend/src/pages/shared/UnauthorizedPage.jsx`

### frontend/src/styles (1)

- `frontend/src/styles/prodile.css`

### frontend/src/utils (2)

- `frontend/src/utils/formatCurrency.js`
- `frontend/src/utils/formatDate.js`

Additional cleanup: removed unused frontend/public/icons.svg and replaced generic backend/README.md and frontend/README.md with the root README.md. Empty feature folders and empty docs/firmware directories were removed. Historical migrations retain old model names deliberately so existing copies can be upgraded.

## Final important files and modifications

Every retained source file is listed below, including unchanged and new files.

| File | Status | Purpose or change |
| --- | --- | --- |
| [backend/src/app.module.ts](backend/src/app.module.ts) | Modified | Keeps only configuration, Prisma, authentication and security modules. |
| [backend/src/auth/auth.controller.ts](backend/src/auth/auth.controller.ts) | Modified | Keeps registration, login, current user and password change; removes profile editing. |
| [backend/src/auth/auth.dto.ts](backend/src/auth/auth.dto.ts) | New | Combines registration, login and password-change DTOs with their existing validation. |
| [backend/src/auth/auth.module.ts](backend/src/auth/auth.module.ts) | Modified | Removes UsersModule and role guards; wires JWT and validates token lifetime. |
| [backend/src/auth/auth.service.ts](backend/src/auth/auth.service.ts) | Modified | Absorbs required user queries; preserves Argon2id and safe public projections; removes business relations. |
| [backend/src/auth/jwt-auth.guard.ts](backend/src/auth/jwt-auth.guard.ts) | New | Flat location for the bearer JWT guard; eliminates duplicate nested guards. |
| [backend/src/auth/jwt.strategy.ts](backend/src/auth/jwt.strategy.ts) | New | Flat strategy; verifies signature/expiration and reloads active accounts without hashes. |
| [backend/src/main.ts](backend/src/main.ts) | Modified | Retains /api, CORS and strict validation; removes payment webhook raw-body setup. |
| [backend/src/prisma/prisma.module.ts](backend/src/prisma/prisma.module.ts) | Kept unchanged | Preserved existing Prisma/SQLite lifecycle and module wiring. |
| [backend/src/prisma/prisma.service.ts](backend/src/prisma/prisma.service.ts) | Kept unchanged | Preserved existing Prisma/SQLite lifecycle and module wiring. |
| [backend/src/security/encryption.service.spec.ts](backend/src/security/encryption.service.spec.ts) | Modified | Preserves all 36 tests; isolates the service from HTTP authentication and updates sample-key terminology. |
| [backend/src/security/encryption.service.ts](backend/src/security/encryption.service.ts) | Modified | Comments and formatting only. Transpiled executable code matches the original exactly. |
| [backend/src/security/security.controller.ts](backend/src/security/security.controller.ts) | New | Small protected encrypt/decrypt endpoints with bounded input, safe errors and temporary-password enforcement. |
| [backend/src/security/security.module.ts](backend/src/security/security.module.ts) | Modified | Connects AuthModule and the demo controller to EncryptionService. |
| [frontend/src/features/auth/auth-context.js](frontend/src/features/auth/auth-context.js) | Kept unchanged | Preserved existing React authentication context/hook. |
| [frontend/src/features/auth/auth.css](frontend/src/features/auth/auth.css) | Modified | Preserves login styling; removes unused text-button rules and formats CSS. |
| [frontend/src/features/auth/authApi.js](frontend/src/features/auth/authApi.js) | Modified | Keeps only login, current-user and password-change requests. |
| [frontend/src/features/auth/AuthContext.jsx](frontend/src/features/auth/AuthContext.jsx) | Modified | Formatting only; preserves login, token validation, logout and user refresh. |
| [frontend/src/features/auth/authStorage.js](frontend/src/features/auth/authStorage.js) | Kept unchanged | Preserved existing remember-me/session token storage. |
| [frontend/src/features/auth/LoginPage.jsx](frontend/src/features/auth/LoginPage.jsx) | Modified | Sends all active roles to /dashboard; removes dead password recovery and updates prototype description. |
| [frontend/src/features/auth/useAuth.js](frontend/src/features/auth/useAuth.js) | Kept unchanged | Preserved existing React authentication context/hook. |
| [frontend/src/features/dashboard/dashboard.css](frontend/src/features/dashboard/dashboard.css) | Modified | Keeps gradients, panels and responsive styles; removes business styles and adds demo forms. |
| [frontend/src/features/dashboard/DashboardPage.jsx](frontend/src/features/dashboard/DashboardPage.jsx) | Modified | Replaces business statistics with informational cards, AES round trips/tamper checks and password changes. |
| [frontend/src/layouts/AdminLayout.jsx](frontend/src/layouts/AdminLayout.jsx) | Kept unchanged | Preserved existing Condotel layout and route outlet. |
| [frontend/src/layouts/layout.css](frontend/src/layouts/layout.css) | Modified | Prunes obsolete selectors and fixes mobile sidebar variable scope while preserving the design. |
| [frontend/src/layouts/Sidebar.jsx](frontend/src/layouts/Sidebar.jsx) | Modified | Keeps Dashboard, Security Demo, Account and Sign Out; removes business links. |
| [frontend/src/layouts/Topbar.jsx](frontend/src/layouts/Topbar.jsx) | Modified | Keeps current user and logout; removes search, notifications and the profile dropdown. |
| [frontend/src/main.jsx](frontend/src/main.jsx) | Modified | Renders AppRoutes under the existing providers; removes the redundant App wrapper. |
| [frontend/src/routes/AppRoutes.jsx](frontend/src/routes/AppRoutes.jsx) | Modified | Keeps /login and protected /dashboard; unknown paths enter the normal authentication flow. |
| [frontend/src/routes/ProtectedRoute.jsx](frontend/src/routes/ProtectedRoute.jsx) | Modified | Uses real session state without business-role routing; inlines the loading state. |
| [frontend/src/services/apiClient.js](frontend/src/services/apiClient.js) | Kept unchanged | Preserved existing Axios client and bearer-token interceptor. |
| [frontend/src/styles/global.css](frontend/src/styles/global.css) | Kept unchanged | Preserved existing theme variables and global styling. |
| [frontend/src/styles/variables.css](frontend/src/styles/variables.css) | Kept unchanged | Preserved existing theme variables and global styling. |

Other changed/new files:

- `backend/prisma/schema.prisma`: Reduced to User, UserRole and UserStatus; preserved scalar account fields and indexes.
- `backend/prisma/migrations/20261007010000_security_demo/migration.sql`: Prisma-generated migration drops 12 business tables without altering User. Applied to this duplicated database.
- `backend/test/app.e2e-spec.ts`: Replaces Hello World with 15 real database/API tests; temporary databases stay inside backend and are cleaned up.
- `backend/test/jest-e2e.json`: Resolves generated Prisma relative .js imports to TypeScript sources in Jest.
- `backend/package.json`: Removes unused mapped-types, observe and mau dependencies and the unused deployment script.
- `backend/package-lock.json`: Updated using npm in offline lockfile-only mode.
- `backend/.gitignore`: Ignores isolated integration-test databases.
- `backend/.env.example`: Documents database, JWT, CORS, port and backend-only AES settings without secrets.
- `frontend/.env.example`: Documents only the API base URL.
- `frontend/index.html`: Sets the title to Condotel Security Prototype.
- `README.md`: Setup, existing/fresh account instructions, demo flow, routes, tests and operational limits.
- `CLEANUP.md`: This complete review report.

## Prisma and account preservation

Kept: **User**. Removed: GuestProfile, Room, Reservation, Payment, Transaction, NfcCard, NfcAssignment, Device, AccessLog, AuditLog, SystemSetting and Notification.

Used the existing prisma7.config.ts workflow: migrate diff generated the migration, migrate deploy applied it, and prisma generate regenerated the client. No database reset or manual business-data edits were used. Only User and _prisma_migrations remain. Before/after fingerprints confirm all eight User rows, including their Argon2id hashes, are unchanged. Final migration status is current and schema-to-database diff is empty.

## Authentication

Registration and password changes create Argon2id hashes in SQLite; login uses argon2.verify. JWT signatures and expiration are checked, and authenticated requests reload active accounts. Responses and request.user exclude passwordHash. Stored browser tokens are validated through /auth/me before access. All roles use the same dashboard; temporary passwords must be changed before AES use.

Browser checks passed for bad-password feedback, real login, protected redirects, session restoration, password changes, remember-me behavior and logout. Logout clears browser storage; existing JWTs remain valid until expiry because this minimal demo has no revocation store.

## AES

EncryptionService executable code is unchanged: AES-256-GCM, canonical Base64 32-byte master key, fresh random 12-byte IV and 16-byte authentication tag. The master key stays backend-only and is never returned or placed in frontend configuration. Demo samples are not persisted. Tampered ciphertext, IV or tag is rejected before plaintext is returned.

All 36 original AES tests pass. API and browser checks additionally verify round trips, Unicode text, protected access and tamper rejection. API tests also cover missing-key behavior.

## UI

The login page, Condotel branding, theme variables, card gradients, sidebar, topbar and dashboard shell remain. Navigation links reach real sections; business links, search, notifications and dead password-recovery UI are removed. The mobile sidebar width is scoped to the layout so theme loading cannot override it.

Browser checks covered desktop (1440px) and mobile (390px), no horizontal overflow, the 82px mobile sidebar, navigation and real API operations. No JavaScript runtime exceptions occurred; observed UI API calls were limited to retained authentication/security routes.

## Validation results

| Check | Result |
| --- | --- |
| Backend npm run build | PASS |
| Backend npm test -- --runInBand | PASS - 36 tests |
| Backend npm run test:e2e -- --runInBand | PASS - 15 tests |
| Backend npm run lint | PASS |
| Frontend npm run build | PASS |
| Frontend npm run lint | PASS |
| Prisma status and schema diff | PASS |
| Eight accounts and both local .env files unchanged | PASS |
| AES executable implementation unchanged | PASS |
| Dead business-source reference scan | PASS |
| Browser and responsive checks | PASS |

Total backend tests: **51 passing**. Tests use isolated random secrets and temporary databases. No test password or master key is embedded in application source. The existing Jest script prints Node's experimental VM Modules notice; it does not cause a failure.

## Remaining setup

The existing backend/.env has no AES_MASTER_KEY configured. Local secrets were preserved. Follow README.md to generate and set a backend-only key before using encryption on the regular development server. Login remains usable; AES displays a configuration error until the key is supplied. Tests and browser checks used temporary process-local keys. No known build, lint, test or functional failures remain.

## Final source structure

```text
backend/src/
  app.module.ts
  auth/
    auth.controller.ts
    auth.dto.ts
    auth.module.ts
    auth.service.ts
    jwt-auth.guard.ts
    jwt.strategy.ts
  main.ts
  prisma/
    prisma.module.ts
    prisma.service.ts
  security/
    encryption.service.spec.ts
    encryption.service.ts
    security.controller.ts
    security.module.ts

frontend/src/
  features/
    auth/
      auth-context.js
      auth.css
      authApi.js
      AuthContext.jsx
      authStorage.js
      LoginPage.jsx
      useAuth.js
    dashboard/
      dashboard.css
      DashboardPage.jsx
  layouts/
    AdminLayout.jsx
    layout.css
    Sidebar.jsx
    Topbar.jsx
  main.jsx
  routes/
    AppRoutes.jsx
    ProtectedRoute.jsx
  services/
    apiClient.js
  styles/
    global.css
    variables.css
```

Generated Prisma files are omitted. The integration test remains at backend/test/app.e2e-spec.ts.
