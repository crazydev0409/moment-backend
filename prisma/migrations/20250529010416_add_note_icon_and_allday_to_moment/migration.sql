-- AlterTable
ALTER TABLE "Moment" ADD COLUMN     "allDay" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "icon" TEXT,
ADD COLUMN     "note" TEXT;
