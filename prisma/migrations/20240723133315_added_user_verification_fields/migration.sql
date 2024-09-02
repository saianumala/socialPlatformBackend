/*
  Warnings:

  - Made the column `description` on table `post` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "User" ADD COLUMN     "VerificationExpiry" TIMESTAMP(3),
ADD COLUMN     "isVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "verifyToken" TEXT;

-- AlterTable
ALTER TABLE "post" ALTER COLUMN "description" SET NOT NULL;
