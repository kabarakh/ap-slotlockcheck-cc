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
    "unknownSlotNames" TEXT NOT NULL DEFAULT '[]'
);
INSERT INTO "new_Room" ("archipelagoOrigin", "archipelagoRoomId", "archipelagoTrackerId", "cheeseTrackerId", "createdAt", "id", "lastSuccessfulSyncAt", "lastSyncAt", "lastSyncError", "limitsOverridden", "ownerCtUserId", "ownerDiscordName", "redLimitHours", "slug", "title", "yellowLimitHours") SELECT "archipelagoOrigin", "archipelagoRoomId", "archipelagoTrackerId", "cheeseTrackerId", "createdAt", "id", "lastSuccessfulSyncAt", "lastSyncAt", "lastSyncError", "limitsOverridden", "ownerCtUserId", "ownerDiscordName", "redLimitHours", "slug", "title", "yellowLimitHours" FROM "Room";
DROP TABLE "Room";
ALTER TABLE "new_Room" RENAME TO "Room";
CREATE UNIQUE INDEX "Room_slug_key" ON "Room"("slug");
CREATE UNIQUE INDEX "Room_cheeseTrackerId_key" ON "Room"("cheeseTrackerId");
CREATE TABLE "new_User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "discordId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "username" TEXT NOT NULL DEFAULT '',
    "avatar" TEXT,
    "lastLoginAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_User" ("avatar", "createdAt", "discordId", "id", "lastLoginAt", "name") SELECT "avatar", "createdAt", "discordId", "id", "lastLoginAt", "name" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_discordId_key" ON "User"("discordId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
