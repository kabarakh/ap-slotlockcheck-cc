-- CreateTable
CREATE TABLE "PaceSignalState" (
    "roomId" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "state" TEXT NOT NULL,
    "lastSnapshotIds" TEXT NOT NULL,
    "unreadableSnapshots" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PaceSignalState_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
