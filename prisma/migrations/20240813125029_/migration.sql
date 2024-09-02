/*
  Warnings:

  - You are about to drop the column `followedByUserId` on the `Follow` table. All the data in the column will be lost.
  - You are about to drop the column `followingUserId` on the `Follow` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[followedByUsername,followingUsername]` on the table `Follow` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `followedByUsername` to the `Follow` table without a default value. This is not possible if the table is not empty.
  - Added the required column `followingUsername` to the `Follow` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Follow" DROP CONSTRAINT "Follow_followedByUserId_fkey";

-- DropForeignKey
ALTER TABLE "Follow" DROP CONSTRAINT "Follow_followingUserId_fkey";

-- DropIndex
DROP INDEX "Follow_followedByUserId_followingUserId_key";

-- AlterTable
ALTER TABLE "Follow" DROP COLUMN "followedByUserId",
DROP COLUMN "followingUserId",
ADD COLUMN     "followedByUsername" TEXT NOT NULL,
ADD COLUMN     "followingUsername" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Follow_followedByUsername_followingUsername_key" ON "Follow"("followedByUsername", "followingUsername");

-- AddForeignKey
ALTER TABLE "Follow" ADD CONSTRAINT "Follow_followedByUsername_fkey" FOREIGN KEY ("followedByUsername") REFERENCES "User"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Follow" ADD CONSTRAINT "Follow_followingUsername_fkey" FOREIGN KEY ("followingUsername") REFERENCES "User"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;
