-- AlterTable
ALTER TABLE "Slot" ADD COLUMN "goalTime" DATETIME;
ALTER TABLE "Slot" ADD COLUMN "goalTimeSource" TEXT;

UPDATE "Slot"
SET "goalTime" = "lastActivity", "goalTimeSource" = 'estimated'
WHERE "lastActivity" IS NOT NULL
  AND ("archipelagoGoal" = 1 OR "completionStatus" IN ('goal', 'done', 'released'));
