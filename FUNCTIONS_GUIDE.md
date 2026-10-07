# Condotel System: Folder, File, and Function Guide

Read [README.md](README.md) first for the system overview, setup, API routes, and limitations. This guide explains the current code and how its parts work together.

Authentication and encrypted door-device registration are functional. Dashboard, Guests, Rooms, and Reservations use static examples. Other business pages are placeholders.

## 1. Code terms and coverage

A React **component** renders an interface. A **hook** accesses state or lifecycle behavior. A NestJS **controller** receives HTTP requests, a **service** performs work, a **module** connects dependencies, a **DTO** defines accepted request fields, and a **guard** checks access. A Prisma **model** defines database records; a **migration** changes the schema.

Paths are relative to the project root. All hand-written application source files are covered below. Generated clients, compiled output, third-party packages, and developer-tool bundles are explained by purpose rather than documenting every generated or vendor function. CSS, SQL, JSON, and environment files are described by responsibility because they do not contain application functions.

## 2. Root folder

| File/folder | Purpose |
| --- | --- |
| `README.md` | System overview, supported features, security, setup, API, and validation commands. |
| `FUNCTIONS_GUIDE.md` | This folder, file, and function reference. |
| `CLEANUP.md` | Historical cleanup report; older sections describe earlier application states. |
| `.gitignore` | Excludes configured local files and generated artifacts from Git. |
| `.git/` | Repository history and metadata, not application code. |
| `backend/` | NestJS API, database schema, security, and tests. |
| `frontend/` | React interface, routing, API client, and styles. |

## 3. Backend startup

### `backend/src/main.ts`

**`bootstrap()`** creates the Nest application using AppModule, loads ConfigService, adds the `/api` prefix, enables CORS for FRONTEND_URL (default `http://localhost:5173`), installs the global ValidationPipe, and listens on PORT (default 3000). The pipe transforms DTO inputs and rejects unexpected properties. `void bootstrap()` invokes startup.

CORS controls browser access; it does not replace authentication.

### `backend/src/app.module.ts`

**`AppModule`** connects global configuration, PrismaModule, AuthModule, SecurityModule, and DevicesModule. Nest uses its module metadata to assemble the application; it has no business-processing methods.

## 4. Backend authentication: `backend/src/auth/`

### `auth.controller.ts`

**`AuthController`** receives AuthService through its constructor and handles `/api/auth` requests.

| Method | Route and function |
| --- | --- |
| `register(dto)` | POST `/api/auth/register`: forwards validated registration data to AuthService.register(). |
| `login(dto)` | POST `/api/auth/login`: forwards credentials to AuthService.login(); success returns HTTP 200. |
| `me(request)` | GET `/api/auth/me`: returns the safe user placed on the request by Passport. Requires JwtAuthGuard. |
| `changePassword(request, dto)` | POST `/api/auth/change-password`: uses the authenticated user's ID and validated password fields. Requires JwtAuthGuard. |

### `auth.dto.ts`

These DTO classes validate request bodies. Their Transform callbacks normalize identity fields while preserving password characters exactly.

- **`RegisterDto`** requires valid email, password of 8-128 characters, and first/last names of 1-100 characters. Optional username is 3-30 characters using lowercase letters, digits, dots, underscores, and hyphens. Optional phone is at most 30 characters.
- **`LoginDto`** requires identifier of 1-255 characters and password of 1-128 characters.
- **`ChangePasswordDto`** requires currentPassword of 1-128 characters and newPassword of 8-128 characters.

Email, username, and login identifier are trimmed and lowercased. Names and phone are trimmed. Empty optional username/phone values become undefined. Role and status are not accepted registration fields, preventing clients from registering themselves as administrators.

### `auth.service.ts`

**`AuthService`** receives PrismaService and JwtService through its constructor.

**`publicUser`** is an explicit database field selection that excludes passwordHash. **`AuthenticatedUser`** is a TypeScript type derived from that safe selection.

| Method | Function |
| --- | --- |
| `register(dto)` | Hashes the password with argon2.argon2id, creates the User, and returns safe details. Converts uniqueness errors to HTTP 409. |
| `login(dto)` | Finds the account by email or username, requires ACTIVE status, verifies the password with argon2.verify(), updates lastLoginAt, and signs a JWT with the user ID as its subject. Unknown accounts, inactive accounts, and wrong passwords share a 401 response. |
| `findAuthenticatedUser(id)` | Reloads safe account details and rejects unavailable/inactive accounts. Used during authenticated requests. |
| `changePassword(userId, dto)` | Verifies the current password, rejects password reuse, hashes the replacement with Argon2id, clears mustChangePassword, and returns safe account details. |

### `auth.module.ts`

**`AuthModule`** registers Passport, JWT, AuthController, AuthService, JwtStrategy, and JwtAuthGuard. It exports JwtAuthGuard.

Its **`useFactory(config)`** callback requires JWT_SECRET, validates a positive integer JWT_EXPIRES_IN_SECONDS (default 3600), and configures HS256 signing. Invalid configuration stops startup.

### `jwt.strategy.ts`

- **`JwtStrategy.constructor(config, auth)`** configures bearer-token extraction from the Authorization header, HS256 signature verification, and expiration checks.
- **`JwtStrategy.validate(payload)`** requires a nonempty string subject (`sub`) and calls findAuthenticatedUser(). The result becomes request.user.
- **`JwtAuthGuard`** extends Passport AuthGuard('jwt'). It has no custom methods; inherited behavior runs JWT authentication before protected endpoints.

## 5. Door devices: `backend/src/devices/`

This folder implements registration and listing. It does not authenticate physical controller messages or unlock doors.

### `devices.dto.ts`

**`RegisterDeviceDto`** accepts only deviceName. Its Transform callback trims strings, and validation requires 1-100 characters after trimming. IDs and secrets are generated by the backend.

### `devices.controller.ts`

**`DevicesController`** is protected by JwtAuthGuard and receives DevicesService in its constructor.

| Method | Function |
| --- | --- |
| `requireAdmin(user)` | Requires ADMIN role and a cleared mustChangePassword flag; otherwise throws HTTP 403. JWT authentication already checks ACTIVE status. |
| `list(request)` | GET `/api/devices`: checks administrator access and returns metadata. |
| `register(request, dto)` | POST `/api/devices`: checks administrator access and registers the device name. |

Both endpoint responses use Cache-Control: no-store.

### `devices.service.ts`

**`DevicesService`** receives PrismaService and EncryptionService.

- **`deviceDetails`** selects only deviceId, deviceName, and createdAt for public metadata.
- **`list()`** reads metadata ordered newest first.
- **`register(deviceName)`** generates a device secret, encrypts it, and creates a record containing ciphertext, IV, and tag. Returns `{ device, deviceSecret }` only in the initial registration response. Encryption failure becomes HTTP 503 before persistence; duplicate names become HTTP 409.

The service never writes plaintext device secrets to SQLite. There is no secret-retrieval API. Losing the registration response does not undo an already-created record.

### `devices.module.ts`

**`DevicesModule`** imports AuthModule, PrismaModule, and SecurityModule; registers DevicesController; and provides DevicesService.

## 6. AES security: `backend/src/security/`

### `encryption.service.ts`

**`EncryptedValue`** contains Base64 strings named ciphertext, iv, and authTag. **`EncryptionService`** receives ConfigService. It uses AES-256-GCM with a 32-byte master key, random 12-byte IV, and 16-byte authentication tag.

| Method | Input/output and purpose |
| --- | --- |
| `encrypt(plaintext)` | String to EncryptedValue. Loads the master key, validates input type, creates a random IV, encrypts UTF-8 text, and returns Base64 ciphertext/IV/tag. Does not persist data itself. |
| `decrypt(encrypted)` | EncryptedValue to string. Decodes fields, checks IV/tag sizes, supplies the tag, and returns plaintext only after final authentication succeeds. Altered or malformed payloads produce a generic decryption error. |
| `generateRandomKey()` | Returns 32 random bytes encoded as Base64. Creates device secrets; does not read or replace AES_MASTER_KEY. |
| `getMasterKey()` | Private. Reads AES_MASTER_KEY on use, requires canonical Base64 and exactly 32 decoded bytes, and returns a Buffer. Never silently generates a replacement. |
| `decodeBase64(value, errorMessage)` | Private. Decodes the input and checks that encoding it again produces exactly the original string. Rejects ignored characters and invalid padding. |

The backend master key protects all stored device secrets. A device secret belongs to one controller. IV and tag are stored with ciphertext and are needed for decryption. User passwords use Argon2id instead of reversible AES encryption.

### `security.module.ts`

**`SecurityModule`** imports ConfigModule, provides EncryptionService, and exports it for device registration and tests.

### `encryption.service.spec.ts`

- **`beforeEach()`** creates a random test master key and a Nest testing module with mocked configuration.
- **`getConfig`** is the mock function returning test configuration.
- **`afterEach()`** closes the module.
- **`tamper(base64)`** flips one decoded byte and re-encodes it to create corrupted test data.
- **Test callbacks** check round trips, algorithm parameters, IV uniqueness, tampered ciphertext/IV/tag, wrong keys, Unicode/empty text, malformed Base64, invalid IV/tag/key sizes, missing payload/configuration, truncated ciphertext, random device-secret generation, and non-string input rejection.

Parameterized cases produce 36 tests. They do not use the real environment master key.

## 7. Database connection and schema

### `backend/src/prisma/prisma.module.ts`

**`PrismaModule`** is a global module providing and exporting PrismaService.

### `backend/src/prisma/prisma.service.ts`

**`PrismaService`** extends the generated PrismaClient.

- **`constructor(configService)`** requires DATABASE_URL and creates the better-sqlite3 Prisma adapter.
- **`onModuleInit()`** connects Prisma when the module starts.
- **`onModuleDestroy()`** disconnects Prisma during module destruction.

Services use inherited generated operations such as user.findUnique(), user.create(), and device.create(). These are generated database functions, not separately hand-written methods.

### `backend/prisma/schema.prisma`

Declares SQLite and generates CommonJS Prisma Client code under backend/src/generated/prisma/.

| Model/enum | Purpose |
| --- | --- |
| `User` | Generated ID, unique email, optional unique username, passwordHash, names, optional phone, role, status, lastLoginAt, mustChangePassword, and timestamps. |
| `UserRole` | CUSTOMER, STAFF, ADMIN. Default is CUSTOMER. |
| `UserStatus` | ACTIVE, INACTIVE, SUSPENDED. Default is ACTIVE. |
| `Device` | Generated deviceId, unique deviceName, deviceKeyCiphertext, deviceKeyIv, deviceKeyAuthTag, and createdAt. |

There are no current Room, Reservation, Payment, or NFC-card models.

### `backend/prisma/migrations/`

Each dated folder contains migration.sql. Historical table creation does not mean those tables remain in the current schema.

| Folder | Migration purpose |
| --- | --- |
| `20261002082619_init_condotel/` | Original Condotel schema. |
| `20261005145818_add_system_settings/` | Historical settings table. |
| `20261005152713_add_notifications/` | Historical notifications table. |
| `20261006052442_add_must_change_password/` | Account password-change flag. |
| `20261007010000_security_demo/` | Removes obsolete business tables. |
| `20261007020000_register_door_devices/` | Adds the current Device table and unique name index. |

`migration_lock.toml` records the SQLite provider. The database's `_prisma_migrations` table tracks applied migrations. Ignored `backend/prisma/dev.db` stores local data; SQLite may create companion journal/WAL files.

## 8. Backend tests and supporting files

### `backend/test/app.e2e-spec.ts`

**`beforeAll()`** creates an isolated SQLite database inside the backend, applies migrations, uses random test secrets, creates AppModule, and adds the API prefix/validation pipe. **`afterAll()`** closes the application and deletes only the verified test directory.

The 11 test callbacks cover:

1. Registration stores Argon2id hashes and excludes hashes from responses.
2. Duplicate accounts and attempts to register elevated roles are rejected.
3. Wrong passwords and inactive accounts are rejected.
4. Normalized username/email login returns signed JWTs and restores identity.
5. Missing, expired, and forged tokens are rejected.
6. Existing tokens still require an active account.
7. Password changes validate the old password, reject reuse, clear the flag, and update login behavior.
8. Removed business routes return 404.
9. Device operations require an administrator without a pending password change.
10. Persisted device ciphertext decrypts correctly; secrets/IVs differ and lists contain metadata only.
11. Invalid/duplicate names and unusable master keys fail without creating unwanted records.

Real development accounts and devices are not used by these tests.

| File/folder | Purpose |
| --- | --- |
| `backend/test/jest-e2e.json` | Integration-test discovery, Node environment, ts-jest, and relative .js import mapping for generated code during tests. |
| `backend/jest.config.ts` | Unit-test discovery, ts-jest transformation, coverage, and TypeScript alias mapping. |
| `backend/package.json` | Dependencies and scripts: build, format, start, start:dev, start:debug, start:prod, lint, test, test:watch, test:cov, test:debug, test:e2e. |
| `backend/package-lock.json` | Exact dependency resolution for repeatable installs. |
| `backend/prisma7.config.ts` | Loads environment configuration and sets Prisma CLI schema, migration path, and DATABASE_URL. |
| `backend/nest-cli.json` | Sets sourceRoot and deletes old build output before compilation. |
| `backend/tsconfig.json` | Strict TypeScript settings, NodeNext resolution, decorator metadata, declarations, source maps, and incremental compilation. |
| `backend/tsconfig.build.json` | Builds src while excluding tests, dependencies, and previous output. |
| `backend/.oxlintrc.json` | Backend lint rules, including floating-promise checks. |
| `backend/.prettierrc` | Formatting preferences: single quotes and trailing commas. |
| `backend/.env.example` | Configuration template without real keys. |
| `backend/.env` | Ignored local database/server/JWT/AES configuration. Secret values are deliberately not included in documentation. |
| `backend/.gitignore` | Backend-specific local/generated file exclusions. |
| `backend/skills-lock.json`, `backend/.agents/skills/` | Developer-tool skill metadata/instructions, not application runtime code. |
| `backend/src/generated/prisma/` | Generated client, models, types, and runtime support. Regenerate; do not manually edit. |
| `backend/dist/` | Compiled application and build artifacts. |
| `backend/tsconfig.build.tsbuildinfo` | Incremental TypeScript build cache. |
| `backend/node_modules/` | Installed third-party packages. |

## 9. Frontend startup and routing

### `frontend/src/main.jsx`

Calls **createRoot(...).render(...)** to mount React into the HTML root. Wraps AppRoutes in StrictMode, BrowserRouter, and AuthProvider, and imports global/presentation styles. There is no separate App.jsx wrapper.

### `frontend/src/routes/AppRoutes.jsx`

**`AppRoutes()`** maps URLs to components:

| Path | Result |
| --- | --- |
| `/login` | LoginPage. |
| `/` | Redirect to /admin/dashboard. |
| `/change-password` | Protected ChangePasswordPage. |
| `/customer/home` | Protected redirect to /admin/dashboard. |
| `/admin` | Protected AdminLayout, defaulting to dashboard. |
| `/admin/dashboard` | DashboardPage. |
| `/admin/guests` | GuestsPage. |
| `/admin/rooms` | RoomsPage. |
| `/admin/reservations` | ReservationsPage. |
| `/admin/devices` | DevicesPage; administrator access is independently checked by the API. |
| `/admin/users`, `/admin/payments`, `/admin/transactions`, `/admin/reports`, `/admin/settings`, `/admin/nfc` | Shared PlaceholderPage with the corresponding title. |
| Unmatched paths | PlaceholderPage titled Page not found. |

### `frontend/src/routes/ProtectedRoute.jsx`

**`ProtectedRoute()`** shows a loading indicator while restoring the session, redirects unauthenticated visitors to login, and redirects users with mustChangePassword to Change Password. That page remains reachable while the flag is set. Otherwise it renders the nested page through Outlet.

Frontend redirects are navigation behavior; the backend still checks authorization itself.

## 10. Frontend authentication: `frontend/src/features/auth/`

### `useAuth.js`

**`AuthContext`** is created with an initial null value. **`useAuth()`** reads it and throws an explanatory error if called outside AuthProvider.

### `AuthContext.jsx`

**`AuthProvider({ children })`** owns the user and loading state and shares authentication actions with its descendants.

| Function/callback | Function |
| --- | --- |
| `refreshUser()` | Calls getCurrentUser(), updates account state, and returns the refreshed user. |
| `login({ identifier, password, rememberMe })` | Calls loginUser(), stores its JWT with the chosen storage lifetime, updates user state, and returns the user. |
| `logout()` | Removes stored tokens and clears user state. |
| Session-restoration `useEffect` | On mount, checks for a stored token and requests /auth/me. Restores a valid session, clears storage on failure, and ends loading. A cancellation flag prevents updates after unmount. |
| `useMemo` callback | Shares user, isLoading, isAuthenticated, login, logout, and refreshUser as the context value. |

isAuthenticated is derived from the presence of a restored or logged-in user. Sign Out does not revoke an already-issued JWT on the server.

### `authApi.js`

- **`loginUser(credentials)`** posts to /auth/login and returns response data.
- **`getCurrentUser()`** gets /auth/me and returns response data.
- **`changeMyPassword(payload)`** posts to /auth/change-password and returns response data.

All requests use apiClient, whose base URL includes /api.

### `authStorage.js`

Uses `condotel_access_token` as its storage key.

- **`saveAccessToken(token, rememberMe = false)`** clears previous tokens and writes to localStorage for Remember Me, otherwise sessionStorage.
- **`getAccessToken()`** reads localStorage first, then sessionStorage.
- **`clearAccessToken()`** removes the token from both locations.

Only authentication tokens are handled here, not passwords, AES master keys, or device secrets. Stored tokens are still subject to backend expiration checks.

### `LoginPage.jsx`

- **`getHomeRoute()`** returns /admin/dashboard.
- **`LoginPage()`** renders the login form and manages identifier, password, Remember Me, password visibility, errors, and submission state. Redirects already-authenticated users.
- **`handleSubmit(event)`** prevents browser form navigation, invokes context login, navigates on success, displays errors on failure, and clears the submitting indicator.
- **`handleIdentifierChange(event)`** updates the identifier and clears the previous error.
- **`handlePasswordChange(event)`** updates the password and clears the previous error.
- **Inline callbacks** toggle password visibility and Remember Me. Forgot Password is disabled.

### `ChangePasswordPage.jsx`

- **`ChangePasswordPage()`** renders current password, new password, and confirmation fields, with saving state and a message based on mustChangePassword.
- **`handleSubmit(event)`** checks confirmation and minimum length, calls changeMyPassword(), refreshes the user to clear the redirect flag, shows the result, and navigates to the dashboard after success.
- **Input callbacks** update local form state. Passwords are not written to browser storage.

### `auth.css`

Styles the login screen, branding, controls, errors, and authentication loading elements. Change-password styles are in presentation.css.

## 11. Frontend device registration: `frontend/src/features/devices/`

### `DevicesPage.jsx`

- **`errorMessage(error)`** converts backend message arrays or strings into readable text, with a connection-error fallback.
- **`DevicesPage()`** renders the registration form, metadata list, one-time provisioning panel, and loading/errors. Non-admin users see an access explanation instead of device controls.
- **Loading `useEffect`** fetches GET /devices only for administrators, handles the result/error/loading state, and cancels state updates after unmount.
- **`register(event)`** prevents normal form submission, blocks another submission while saving or displaying a secret, posts the trimmed name, adds returned metadata to the list, stores provisioning output temporarily in component state, and clears the name field. It handles errors and always ends saving state.
- **Input callback** updates deviceName.
- **Focus callbacks** select the displayed ID or secret for manual copying.
- **Dismiss callback** sets provisioning to null, clearing the secret from the rendered page and active component state.
- **List mapping callback** renders name, ID, and a localized creation timestamp.

The secret is never written to localStorage/sessionStorage. Reloading the page fetches metadata only. The browser neither receives the AES master key nor performs AES encryption.

### `devices.css`

Styles the registration form, provisioning panel, errors, and device table using existing theme values. Narrow-screen tables scroll inside their container.

## 12. Presentation pages and placeholders

### `frontend/src/features/dashboard/DashboardPage.jsx`

- **`getStatusClass(status)`** converts a status into lowercase hyphenated CSS text.
- **`formatStatus(status)`** turns underscore-separated status words into readable labels.
- **`DashboardPage()`** greets the authenticated user and renders fixed statistics, occupancy values, and a sample reservation. Mapping callbacks create cards and rows. View All navigates to Reservations.

Statistics are illustrative constants, not live totals or actual payment data.

### `frontend/src/features/guests/GuestsPage.jsx`

**`GuestsPage()`** renders a static guest table with disabled search/add/edit controls. Its form callback prevents navigation; its mapping callback renders sample rows. It makes no guest API requests.

### `frontend/src/features/rooms/RoomsPage.jsx`

- **`getStatusClass(status)`** converts status into lowercase hyphenated CSS text.
- **`RoomCard({ room })`** renders an image or icon placeholder, room number/type, formatted price, capacity, floor, status, and disabled actions.
- **`RoomsPage()`** displays two static room examples. Mapping callbacks render filter buttons and RoomCard components. Controls do not perform real filtering or database updates.

### `frontend/src/features/reservations/ReservationsPage.jsx`

**`ReservationsPage()`** renders a static sample reservation table and disabled management controls. Mapping/status formatting and the date/currency helpers affect display only. It performs no reservation, check-in, or check-out processing.

### `frontend/src/features/nfc/PlaceholderPage.jsx`

**`PlaceholderPage({ title })`** displays the supplied title and the message that the page is reserved for presentation and has no connected operation. It is shared by NFC, User Management, Payments, Transactions, Reports, Settings, and unmatched routes. Separate page files for those removed business interfaces do not exist anymore.

## 13. Shared layout: `frontend/src/layouts/`

### `AdminLayout.jsx`

**`AdminLayout()`** renders Sidebar, Topbar, and the main content area. Outlet inserts the selected nested page. The previous preview-information banner is absent.

### `Sidebar.jsx`

- **`navigation`** defines labels, paths, icons, and the administrator-only flag for Device Management.
- **`Sidebar()`** displays account identity, navigation, and Sign Out using authentication context.
- **`visibleNavigation` filter callback** hides administrator-only items from non-admin users.
- **Navigation mapping callback** creates NavLink elements.
- **NavLink `className` callback** applies the active-route style.

API authorization remains necessary even when a link is hidden.

### `Topbar.jsx`

- **`Topbar()`** displays disabled search/notifications and an account dropdown with identity, Change Password, and Sign Out.
- **`go(path)`** closes the dropdown and navigates.
- **Profile button callback** toggles the dropdown.
- **Blur callback** closes it when focus moves outside the menu.
- **Change Password callback** calls go('/change-password').
- **Sign Out callback** invokes the shared logout function.

My Profile is no longer a menu item or page.

### `layout.css`

Styles the sidebar, topbar, dropdown, active navigation, main content, disabled controls, and responsive layout. It contains no network/business operations.

## 14. HTTP client, helpers, and shared styles

### `frontend/src/services/apiClient.js`

Creates the shared Axios client using VITE_API_BASE_URL or `http://localhost:3000/api`, with JSON request headers.

- **Request interceptor success callback** reads the stored token for each request and adds Authorization: Bearer when present.
- **Request interceptor error callback** rejects errors for the caller to handle.

It does not automatically refresh JWTs or redirect on response errors.

### `frontend/src/utils/format.js`

- **`formatCurrency(centavos)`** divides the numeric input by 100 and formats PHP using en-PH with zero to two fractional digits.
- **`formatDate(value)`** returns a dash for absent values; otherwise formats a date using en-PH with year, abbreviated month, and two-digit day.

### `frontend/src/styles/`

| File | Purpose |
| --- | --- |
| `variables.css` | Shared theme values: colors, sizes, border radii, shadows, and sidebar width. |
| `global.css` | Loads theme variables and supplies base typography, element defaults, and shared controls. |
| `presentation.css` | Consolidated Change Password, Dashboard, Guests, Rooms, and Reservations styles. |

## 15. Frontend supporting files

| File/folder | Purpose |
| --- | --- |
| `frontend/index.html` | Browser entry document, root mount element, favicon, and entry module script. |
| `frontend/public/favicon.svg` | Static favicon. |
| `frontend/package.json` | Dependencies and scripts: dev starts Vite, build produces static output, lint checks code, and preview serves built output locally. |
| `frontend/package-lock.json` | Locked npm dependency versions. |
| `frontend/vite.config.js` | Enables the React Vite plugin. |
| `frontend/eslint.config.js` | JavaScript, browser-global, React Hooks, and React Refresh lint configuration; excludes dist. |
| `frontend/.env.example` | Example VITE_API_BASE_URL setting. |
| `frontend/.env` | Local API-base configuration. VITE variables are browser-visible and must not contain backend secrets. |
| `frontend/.gitignore` | Local/generated frontend exclusions. |
| `frontend/dist/` | Generated production HTML, CSS, and JavaScript. |
| `frontend/node_modules/` | Installed third-party packages. |

## 16. Main request flows

### Login

```text
LoginPage.handleSubmit
  -> AuthProvider.login
  -> authApi.loginUser
  -> apiClient
  -> AuthController.login
  -> AuthService.login
  -> SQLite lookup + Argon2 verification
  -> signed JWT + safe user details
  -> token storage + context state
  -> ProtectedRoute + dashboard
```

On reload, AuthProvider calls /auth/me. JwtAuthGuard/JwtStrategy verify the token and recheck the account before returning safe details.

### Register Door Device

```text
DevicesPage.register
  -> apiClient POST /devices
  -> JwtAuthGuard / JwtStrategy
  -> DevicesController.requireAdmin
  -> DevicesService.register
  -> EncryptionService.generateRandomKey
  -> EncryptionService.encrypt
  -> Prisma stores ciphertext + IV + tag
  -> metadata + one-time deviceSecret response
  -> temporary provisioning panel
```

Subsequent GET /devices returns metadata only. Integration tests decrypt the saved fields with EncryptionService.decrypt() to verify the original secret is recoverable with the correct backend master key. No public decrypt route exists.

## 17. Current limits

This version has no connected payment processing, reservation engine, NFC-card validation, automatic ESP32 provisioning, door-unlock command, device request-authentication protocol, key rotation, or secret-recovery interface. A page title or placeholder does not enable those features.

For environment configuration, startup commands, and testing commands, see [README.md](README.md).
