-- CreateTable
CREATE TABLE "LaterUnlockItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "roomId" INTEGER NOT NULL,
    "lockerSlotId" INTEGER NOT NULL,
    "lockedSlotId" INTEGER NOT NULL,
    "senderSlotId" INTEGER,
    "sequence" INTEGER NOT NULL,
    CONSTRAINT "LaterUnlockItem_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LaterUnlockItem_lockerSlotId_fkey" FOREIGN KEY ("lockerSlotId") REFERENCES "Slot" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LaterUnlockItem_lockedSlotId_fkey" FOREIGN KEY ("lockedSlotId") REFERENCES "Slot" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LaterUnlockItem_senderSlotId_fkey" FOREIGN KEY ("senderSlotId") REFERENCES "Slot" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "LaterUnlockItem_roomId_sequence_key" ON "LaterUnlockItem"("roomId", "sequence");
