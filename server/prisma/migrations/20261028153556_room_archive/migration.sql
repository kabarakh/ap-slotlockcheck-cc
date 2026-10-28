-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
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
    "playersMarkFiller" BOOLEAN NOT NULL DEFAULT false,
    "paceBreakLimitMinutes" INTEGER NOT NULL DEFAULT 30,
    "paceBulkLimitChecks" INTEGER NOT NULL DEFAULT 40,
    "archivedAt" DATETIME,
    "archiveReason" TEXT,
    "autoArchive" BOOLEAN NOT NULL DEFAULT true
);
INSERT INTO "new_Room" ("archipelagoOrigin", "archipelagoRoomId", "archipelagoTrackerId", "cheeseTrackerId", "createdAt", "id", "lastSuccessfulSyncAt", "lastSyncAt", "lastSyncError", "limitsOverridden", "ownerCtUserId", "ownerDiscordName", "paceBreakLimitMinutes", "paceBulkLimitChecks", "playersMarkFiller", "redLimitHours", "slug", "sphereOffset", "title", "unknownSlotNames", "visitorsSeeLocations", "yellowLimitHours") SELECT "archipelagoOrigin", "archipelagoRoomId", "archipelagoTrackerId", "cheeseTrackerId", "createdAt", "id", "lastSuccessfulSyncAt", "lastSyncAt", "lastSyncError", "limitsOverridden", "ownerCtUserId", "ownerDiscordName", "paceBreakLimitMinutes", "paceBulkLimitChecks", "playersMarkFiller", "redLimitHours", "slug", "sphereOffset", "title", "unknownSlotNames", "visitorsSeeLocations", "yellowLimitHours" FROM "Room";
DROP TABLE "Room";
ALTER TABLE "new_Room" RENAME TO "Room";
CREATE UNIQUE INDEX "Room_slug_key" ON "Room"("slug");
CREATE UNIQUE INDEX "Room_cheeseTrackerId_key" ON "Room"("cheeseTrackerId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
