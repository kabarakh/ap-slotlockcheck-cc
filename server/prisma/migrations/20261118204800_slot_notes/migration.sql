-- CreateTable
CREATE TABLE "SlotNote" (
    "slotId" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    "updatedByUserId" INTEGER NOT NULL,

    PRIMARY KEY ("slotId", "kind"),
    CONSTRAINT "SlotNote_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "Slot" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SlotNote_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
