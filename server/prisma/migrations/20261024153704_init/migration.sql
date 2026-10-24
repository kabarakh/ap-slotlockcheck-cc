-- CreateTable
CREATE TABLE "User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "discordId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "avatar" TEXT,
    "lastLoginAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Room" (
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
    "lastSyncError" TEXT
);

-- CreateTable
CREATE TABLE "RoomAdmin" (
    "roomId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "isOwner" BOOLEAN NOT NULL DEFAULT false,

    PRIMARY KEY ("roomId", "userId"),
    CONSTRAINT "RoomAdmin_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RoomAdmin_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Slot" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "roomId" INTEGER NOT NULL,
    "cheeseGameId" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "game" TEXT NOT NULL,
    "discordUserId" TEXT,
    "discordName" TEXT,
    "checksDone" INTEGER NOT NULL,
    "checksTotal" INTEGER NOT NULL,
    "lastActivity" DATETIME,
    "trackerStatus" TEXT NOT NULL,
    "progressionStatus" TEXT NOT NULL,
    "completionStatus" TEXT NOT NULL,
    "availabilityStatus" TEXT NOT NULL,
    "notes" TEXT NOT NULL,
    "isSlotLock" BOOLEAN NOT NULL DEFAULT false,
    "isSelectedSlotLock" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "Slot_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LockAssignment" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "roomId" INTEGER NOT NULL,
    "lockerSlotId" INTEGER NOT NULL,
    "lockedSlotId" INTEGER NOT NULL,
    "source" TEXT NOT NULL,
    "notLocked" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "LockAssignment_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LockAssignment_lockerSlotId_fkey" FOREIGN KEY ("lockerSlotId") REFERENCES "Slot" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LockAssignment_lockedSlotId_fkey" FOREIGN KEY ("lockedSlotId") REFERENCES "Slot" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UnlockItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "roomId" INTEGER NOT NULL,
    "lockerSlotId" INTEGER NOT NULL,
    "lockedSlotId" INTEGER NOT NULL,
    "senderSlotId" INTEGER,
    "firstSeenAt" DATETIME NOT NULL,
    "unlockTime" DATETIME,
    "timeSource" TEXT NOT NULL,
    CONSTRAINT "UnlockItem_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UnlockItem_lockerSlotId_fkey" FOREIGN KEY ("lockerSlotId") REFERENCES "Slot" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UnlockItem_lockedSlotId_fkey" FOREIGN KEY ("lockedSlotId") REFERENCES "Slot" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UnlockItem_senderSlotId_fkey" FOREIGN KEY ("senderSlotId") REFERENCES "Slot" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Warning" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "roomId" INTEGER NOT NULL,
    "slotId" INTEGER NOT NULL,
    "adminUserId" INTEGER NOT NULL,
    "date" DATETIME NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Warning_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Warning_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "Slot" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Warning_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SyncRun" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "roomId" INTEGER NOT NULL,
    "trigger" TEXT NOT NULL,
    "startedAt" DATETIME NOT NULL,
    "finishedAt" DATETIME,
    "result" TEXT NOT NULL,
    "error" TEXT,
    CONSTRAINT "SyncRun_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SyncSnapshot" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "roomId" INTEGER NOT NULL,
    "source" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "firstSyncRunId" INTEGER NOT NULL,
    "lastSyncRunId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SyncSnapshot_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Datapackage" (
    "checksum" TEXT NOT NULL PRIMARY KEY,
    "game" TEXT NOT NULL,
    "itemNames" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "AdminInvitation" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "roomId" INTEGER NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "validUntil" DATETIME NOT NULL,
    "createdByUserId" INTEGER NOT NULL,
    "usedByUserId" INTEGER,
    "usedAt" DATETIME,
    CONSTRAINT "AdminInvitation_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_discordId_key" ON "User"("discordId");

-- CreateIndex
CREATE UNIQUE INDEX "Room_slug_key" ON "Room"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Room_cheeseTrackerId_key" ON "Room"("cheeseTrackerId");

-- CreateIndex
CREATE UNIQUE INDEX "Slot_roomId_position_key" ON "Slot"("roomId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "LockAssignment_lockerSlotId_lockedSlotId_key" ON "LockAssignment"("lockerSlotId", "lockedSlotId");

-- CreateIndex
CREATE UNIQUE INDEX "UnlockItem_lockerSlotId_lockedSlotId_key" ON "UnlockItem"("lockerSlotId", "lockedSlotId");

-- CreateIndex
CREATE INDEX "SyncSnapshot_roomId_source_idx" ON "SyncSnapshot"("roomId", "source");

-- CreateIndex
CREATE UNIQUE INDEX "AdminInvitation_tokenHash_key" ON "AdminInvitation"("tokenHash");
