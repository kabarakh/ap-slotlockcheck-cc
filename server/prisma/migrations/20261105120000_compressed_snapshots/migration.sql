-- AlterTable
ALTER TABLE "Room" ADD COLUMN "snapshotsPrunedAt" DATETIME;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_SyncSnapshot" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "roomId" INTEGER NOT NULL,
    "source" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "compressedPayload" BLOB,
    "payload" TEXT,
    "firstSyncRunId" INTEGER NOT NULL,
    "lastSyncRunId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SyncSnapshot_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_SyncSnapshot" ("createdAt", "firstSyncRunId", "hash", "id", "lastSyncRunId", "payload", "roomId", "source") SELECT "createdAt", "firstSyncRunId", "hash", "id", "lastSyncRunId", "payload", "roomId", "source" FROM "SyncSnapshot";
DROP TABLE "SyncSnapshot";
ALTER TABLE "new_SyncSnapshot" RENAME TO "SyncSnapshot";
CREATE INDEX "SyncSnapshot_roomId_source_idx" ON "SyncSnapshot"("roomId", "source");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

