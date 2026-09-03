-- AlterTable
ALTER TABLE "Thread" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Backfill: a thread's real last activity is its newest turn, falling back to
-- its own creation time for a thread that never got a prompt. Without this
-- every pre-existing thread would claim it was active the moment this
-- migration ran, which is exactly the kind of made-up number this app exists
-- to not show.
UPDATE "Thread" t
SET "updatedAt" = COALESCE(
    (SELECT MAX(turn."createdAt") FROM "Turn" turn WHERE turn."threadId" = t."id"),
    t."createdAt"
);

-- CreateIndex
CREATE INDEX "Thread_userId_updatedAt_idx" ON "Thread"("userId", "updatedAt");
