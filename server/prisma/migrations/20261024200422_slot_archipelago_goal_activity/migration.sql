-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Slot" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "roomId" INTEGER NOT NULL,
    "cheeseGameId" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "archipelagoName" TEXT,
    "archipelagoGoal" BOOLEAN NOT NULL DEFAULT false,
    "archipelagoActivity" DATETIME,
    "game" TEXT NOT NULL,
    "discordUserId" TEXT,
    "discordName" TEXT,
    "checksDone" INTEGER NOT NULL,
    "checksTotal" INTEGER NOT NULL,
    "lastActivity" DATETIME,
    "lastChecked" DATETIME,
    "trackerStatus" TEXT NOT NULL,
    "progressionStatus" TEXT NOT NULL,
    "completionStatus" TEXT NOT NULL,
    "availabilityStatus" TEXT NOT NULL,
    "notes" TEXT NOT NULL,
    "isSlotLock" BOOLEAN NOT NULL DEFAULT false,
    "isSelectedSlotLock" BOOLEAN NOT NULL DEFAULT false,
    "isStartSlot" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "Slot_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Slot" ("archipelagoName", "availabilityStatus", "checksDone", "checksTotal", "cheeseGameId", "completionStatus", "discordName", "discordUserId", "game", "id", "isSelectedSlotLock", "isSlotLock", "isStartSlot", "lastActivity", "lastChecked", "name", "notes", "position", "progressionStatus", "roomId", "trackerStatus") SELECT "archipelagoName", "availabilityStatus", "checksDone", "checksTotal", "cheeseGameId", "completionStatus", "discordName", "discordUserId", "game", "id", "isSelectedSlotLock", "isSlotLock", "isStartSlot", "lastActivity", "lastChecked", "name", "notes", "position", "progressionStatus", "roomId", "trackerStatus" FROM "Slot";
DROP TABLE "Slot";
ALTER TABLE "new_Slot" RENAME TO "Slot";
CREATE UNIQUE INDEX "Slot_roomId_position_key" ON "Slot"("roomId", "position");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
