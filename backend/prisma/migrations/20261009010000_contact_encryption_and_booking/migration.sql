-- Expand only. Stop application writers before applying this migration.
-- Run the offline audit/backfill/verify/finalize procedure before restarting.
PRAGMA foreign_keys=OFF;
BEGIN IMMEDIATE;
CREATE TABLE "new_User" (
  "id" TEXT NOT NULL PRIMARY KEY, "email" TEXT, "username" TEXT,
  "passwordHash" TEXT NOT NULL, "firstName" TEXT NOT NULL, "lastName" TEXT NOT NULL,
  "phone" TEXT, "role" TEXT NOT NULL DEFAULT 'CUSTOMER', "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "lastLoginAt" DATETIME, "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL,
  "emailCiphertext" TEXT, "emailIv" TEXT, "emailAuthTag" TEXT, "emailBlindIndex" TEXT,
  "phoneCiphertext" TEXT, "phoneIv" TEXT, "phoneAuthTag" TEXT, "phoneBlindIndex" TEXT
);
INSERT INTO "new_User" ("id","email","username","passwordHash","firstName","lastName","phone","role","status","lastLoginAt","mustChangePassword","createdAt","updatedAt")
SELECT "id","email","username","passwordHash","firstName","lastName","phone","role","status","lastLoginAt","mustChangePassword","createdAt","updatedAt" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
CREATE INDEX "User_role_idx" ON "User"("role");
CREATE INDEX "User_status_idx" ON "User"("status");
CREATE INDEX "User_lastName_firstName_idx" ON "User"("lastName","firstName");
-- Deliberately non-unique until normalization collisions have been audited.
CREATE INDEX "User_emailBlindIndex_staging_idx" ON "User"("emailBlindIndex");
CREATE INDEX "User_phoneBlindIndex_idx" ON "User"("phoneBlindIndex");

CREATE TABLE "Room" (
  "id" TEXT NOT NULL PRIMARY KEY, "roomNumber" TEXT NOT NULL, "roomType" TEXT NOT NULL,
  "floor" INTEGER, "capacity" INTEGER NOT NULL DEFAULT 2, "ratePerNightCentavos" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'AVAILABLE', "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "Room_roomNumber_key" ON "Room"("roomNumber");
CREATE TABLE "Reservation" (
  "id" TEXT NOT NULL PRIMARY KEY, "referenceNo" TEXT NOT NULL, "guestId" TEXT NOT NULL,
  "roomId" TEXT NOT NULL, "checkIn" DATETIME NOT NULL, "checkOut" DATETIME NOT NULL,
  "adults" INTEGER NOT NULL DEFAULT 1, "children" INTEGER NOT NULL DEFAULT 0,
  "totalAmountCentavos" INTEGER NOT NULL, "status" TEXT NOT NULL DEFAULT 'PENDING',
  "specialRequests" TEXT, "specialRequestsCiphertext" TEXT, "specialRequestsIv" TEXT, "specialRequestsAuthTag" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL,
  FOREIGN KEY ("guestId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Reservation_referenceNo_key" ON "Reservation"("referenceNo");
CREATE INDEX "Reservation_guestId_idx" ON "Reservation"("guestId");
CREATE INDEX "Reservation_roomId_checkIn_checkOut_idx" ON "Reservation"("roomId","checkIn","checkOut");
CREATE TABLE "Payment" (
  "id" TEXT NOT NULL PRIMARY KEY, "reservationId" TEXT NOT NULL, "paymongoCheckoutSessionId" TEXT,
  "amountCentavos" INTEGER NOT NULL, "currency" TEXT NOT NULL DEFAULT 'PHP', "status" TEXT NOT NULL DEFAULT 'CREATING',
  "checkoutUrl" TEXT, "paidAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL,
  FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Payment_reservationId_key" ON "Payment"("reservationId");
CREATE UNIQUE INDEX "Payment_paymongoCheckoutSessionId_key" ON "Payment"("paymongoCheckoutSessionId");
CREATE TABLE "Notification" (
  "id" TEXT NOT NULL PRIMARY KEY, "userId" TEXT NOT NULL, "type" TEXT NOT NULL, "message" TEXT NOT NULL,
  "entityId" TEXT, "dedupeKey" TEXT NOT NULL, "isRead" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Notification_dedupeKey_key" ON "Notification"("dedupeKey");
CREATE INDEX "Notification_userId_isRead_idx" ON "Notification"("userId","isRead");
COMMIT;
PRAGMA foreign_keys=ON;
