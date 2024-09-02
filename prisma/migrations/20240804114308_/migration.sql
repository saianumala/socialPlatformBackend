/*
  Warnings:

  - You are about to drop the column `followedById` on the `Follow` table. All the data in the column will be lost.
  - You are about to drop the column `followingId` on the `Follow` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[followedByUserId,followingUserId]` on the table `Follow` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `followedByUserId` to the `Follow` table without a default value. This is not possible if the table is not empty.
  - Added the required column `followingUserId` to the `Follow` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Follow" DROP CONSTRAINT "Follow_followedById_fkey";

-- DropForeignKey
ALTER TABLE "Follow" DROP CONSTRAINT "Follow_followingId_fkey";

-- DropIndex
DROP INDEX "Follow_followedById_followingId_key";

-- AlterTable
ALTER TABLE "Follow" DROP COLUMN "followedById",
DROP COLUMN "followingId",
ADD COLUMN     "followedByUserId" TEXT NOT NULL,
ADD COLUMN     "followingUserId" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Follow_followedByUserId_followingUserId_key" ON "Follow"("followedByUserId", "followingUserId");

-- AddForeignKey
ALTER TABLE "Follow" ADD CONSTRAINT "Follow_followedByUserId_fkey" FOREIGN KEY ("followedByUserId") REFERENCES "User"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Follow" ADD CONSTRAINT "Follow_followingUserId_fkey" FOREIGN KEY ("followingUserId") REFERENCES "User"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;
