-- CreateTable
CREATE TABLE "Device" (
    "deviceId" TEXT NOT NULL PRIMARY KEY,
    "deviceName" TEXT NOT NULL,
    "deviceKeyCiphertext" TEXT NOT NULL,
    "deviceKeyIv" TEXT NOT NULL,
    "deviceKeyAuthTag" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "Device_deviceName_key" ON "Device"("deviceName");
