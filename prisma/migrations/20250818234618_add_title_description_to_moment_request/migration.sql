/*
  Warnings:

  - Added the required column `title` to the `MomentRequest` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "MomentRequest" ADD COLUMN     "description" TEXT,
ADD COLUMN     "title" TEXT NOT NULL;
