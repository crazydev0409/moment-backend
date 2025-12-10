-- AlterTable
ALTER TABLE "Moment" ADD COLUMN     "sharedWith" TEXT[];

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "defaultCalendarVisibility" TEXT NOT NULL DEFAULT 'busy';

-- CreateTable
CREATE TABLE "BlockedContact" (
    "id" TEXT NOT NULL,
    "blockerId" TEXT NOT NULL,
    "blockedId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BlockedContact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BlockedContact_blockerId_blockedId_key" ON "BlockedContact"("blockerId", "blockedId");

-- AddForeignKey
ALTER TABLE "BlockedContact" ADD CONSTRAINT "BlockedContact_blockerId_fkey" FOREIGN KEY ("blockerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlockedContact" ADD CONSTRAINT "BlockedContact_blockedId_fkey" FOREIGN KEY ("blockedId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
