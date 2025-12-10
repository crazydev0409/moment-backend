/*
  Warnings:

  - You are about to drop the column `createdAt` on the `Contact` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[ownerId,contactPhone]` on the table `Contact` will be added. If there are existing duplicate values, this will fail.
  - Made the column `displayName` on table `Contact` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Contact" DROP COLUMN "createdAt",
ADD COLUMN     "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "phoneBookId" TEXT,
ALTER COLUMN "displayName" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Contact_ownerId_contactPhone_key" ON "Contact"("ownerId", "contactPhone");
