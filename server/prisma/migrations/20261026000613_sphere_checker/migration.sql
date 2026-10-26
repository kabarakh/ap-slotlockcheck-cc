-- AlterTable
ALTER TABLE "Datapackage" ADD COLUMN "locationNames" TEXT;

-- CreateTable
CREATE TABLE "SeedData" (
    "roomId" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "seedName" TEXT NOT NULL,
    "archipelagoVersion" TEXT NOT NULL,
    "locationCount" INTEGER NOT NULL,
    "sphereCount" INTEGER NOT NULL,
    "unreachableLocationCount" INTEGER NOT NULL,
    "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploadedByUserId" INTEGER NOT NULL,
    CONSTRAINT "SeedData_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SeedData_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SeedLocation" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "roomId" INTEGER NOT NULL,
    "finderSlotId" INTEGER NOT NULL,
    "receiverSlotId" INTEGER,
    "receiverName" TEXT NOT NULL,
    "locationId" BIGINT NOT NULL,
    "locationName" TEXT NOT NULL,
    "itemId" BIGINT NOT NULL,
    "itemName" TEXT NOT NULL,
    "itemType" TEXT NOT NULL,
    "sphere" INTEGER NOT NULL,
    "checked" BOOLEAN NOT NULL DEFAULT false,
    "checkedFirstSeenAt" DATETIME,
    "fillerMarkedAt" DATETIME,
    "fillerMarkedByUserId" INTEGER,
    CONSTRAINT "SeedLocation_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SeedLocation_finderSlotId_fkey" FOREIGN KEY ("finderSlotId") REFERENCES "Slot" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SeedLocation_receiverSlotId_fkey" FOREIGN KEY ("receiverSlotId") REFERENCES "Slot" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "SeedLocation_fillerMarkedByUserId_fkey" FOREIGN KEY ("fillerMarkedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AdminInvitation" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "roomId" INTEGER NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "validUntil" DATETIME NOT NULL,
    "createdByUserId" INTEGER NOT NULL,
    "usedByUserId" INTEGER,
    "usedAt" DATETIME,
    "role" TEXT NOT NULL DEFAULT 'admin',
    CONSTRAINT "AdminInvitation_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_AdminInvitation" ("createdByUserId", "id", "roomId", "tokenHash", "usedAt", "usedByUserId", "validUntil") SELECT "createdByUserId", "id", "roomId", "tokenHash", "usedAt", "usedByUserId", "validUntil" FROM "AdminInvitation";
DROP TABLE "AdminInvitation";
ALTER TABLE "new_AdminInvitation" RENAME TO "AdminInvitation";
CREATE UNIQUE INDEX "AdminInvitation_tokenHash_key" ON "AdminInvitation"("tokenHash");
CREATE TABLE "new_Room" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "cheeseTrackerId" TEXT NOT NULL,
    "archipelagoOrigin" TEXT NOT NULL,
    "archipelagoRoomId" TEXT,
    "archipelagoTrackerId" TEXT NOT NULL,
    "ownerCtUserId" INTEGER,
    "ownerDiscordName" TEXT,
    "yellowLimitHours" INTEGER NOT NULL,
    "redLimitHours" INTEGER NOT NULL,
    "limitsOverridden" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSyncAt" DATETIME,
    "lastSuccessfulSyncAt" DATETIME,
    "lastSyncError" TEXT,
    "unknownSlotNames" TEXT NOT NULL DEFAULT '[]',
    "sphereOffset" INTEGER NOT NULL DEFAULT 0,
    "visitorsSeeLocations" BOOLEAN NOT NULL DEFAULT false,
    "playersMarkFiller" BOOLEAN NOT NULL DEFAULT false
);
INSERT INTO "new_Room" ("archipelagoOrigin", "archipelagoRoomId", "archipelagoTrackerId", "cheeseTrackerId", "createdAt", "id", "lastSuccessfulSyncAt", "lastSyncAt", "lastSyncError", "limitsOverridden", "ownerCtUserId", "ownerDiscordName", "redLimitHours", "slug", "title", "unknownSlotNames", "yellowLimitHours") SELECT "archipelagoOrigin", "archipelagoRoomId", "archipelagoTrackerId", "cheeseTrackerId", "createdAt", "id", "lastSuccessfulSyncAt", "lastSyncAt", "lastSyncError", "limitsOverridden", "ownerCtUserId", "ownerDiscordName", "redLimitHours", "slug", "title", "unknownSlotNames", "yellowLimitHours" FROM "Room";
DROP TABLE "Room";
ALTER TABLE "new_Room" RENAME TO "Room";
CREATE UNIQUE INDEX "Room_slug_key" ON "Room"("slug");
CREATE UNIQUE INDEX "Room_cheeseTrackerId_key" ON "Room"("cheeseTrackerId");
CREATE TABLE "new_RoomAdmin" (
    "roomId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "isOwner" BOOLEAN NOT NULL DEFAULT false,
    "role" TEXT NOT NULL DEFAULT 'admin',

    PRIMARY KEY ("roomId", "userId"),
    CONSTRAINT "RoomAdmin_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RoomAdmin_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_RoomAdmin" ("isOwner", "roomId", "userId") SELECT "isOwner", "roomId", "userId" FROM "RoomAdmin";
DROP TABLE "RoomAdmin";
ALTER TABLE "new_RoomAdmin" RENAME TO "RoomAdmin";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "SeedLocation_roomId_sphere_idx" ON "SeedLocation"("roomId", "sphere");

-- CreateIndex
CREATE INDEX "SeedLocation_roomId_checked_sphere_idx" ON "SeedLocation"("roomId", "checked", "sphere");

-- CreateIndex
CREATE INDEX "SeedLocation_roomId_finderSlotId_idx" ON "SeedLocation"("roomId", "finderSlotId");

-- CreateIndex
CREATE UNIQUE INDEX "SeedLocation_roomId_finderSlotId_locationId_key" ON "SeedLocation"("roomId", "finderSlotId", "locationId");
