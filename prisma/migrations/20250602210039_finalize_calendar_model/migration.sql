/*
  Warnings:

  - You are about to drop the column `note` on the `Moment` table. All the data in the column will be lost.
  - You are about to drop the column `sharedWith` on the `Moment` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `Moment` table. All the data in the column will be lost.
  - You are about to drop the column `description` on the `MomentRequest` table. All the data in the column will be lost.
  - You are about to drop the column `title` on the `MomentRequest` table. All the data in the column will be lost.
  - You are about to drop the column `defaultCalendarVisibility` on the `User` table. All the data in the column will be lost.
  - You are about to drop the `CalendarVisibility` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `WorkingHours` table. If the table is not empty, all the data it contains will be lost.
  - Made the column `calendarId` on table `Moment` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "CalendarVisibility" DROP CONSTRAINT "CalendarVisibility_ownerId_fkey";

-- DropForeignKey
ALTER TABLE "CalendarVisibility" DROP CONSTRAINT "CalendarVisibility_viewerId_fkey";

-- DropForeignKey
ALTER TABLE "Moment" DROP CONSTRAINT "Moment_userId_fkey";

-- DropForeignKey
ALTER TABLE "WorkingHours" DROP CONSTRAINT "WorkingHours_userId_fkey";

-- AlterTable
ALTER TABLE "Moment" DROP COLUMN "note",
DROP COLUMN "sharedWith",
DROP COLUMN "userId",
ALTER COLUMN "calendarId" SET NOT NULL;

-- AlterTable
ALTER TABLE "MomentRequest" DROP COLUMN "description",
DROP COLUMN "title";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "defaultCalendarVisibility";

-- DropTable
DROP TABLE "CalendarVisibility";

-- DropTable
DROP TABLE "WorkingHours";
