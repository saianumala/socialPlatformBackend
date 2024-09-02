/*
  Warnings:

  - You are about to drop the `_follow` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "_follow" DROP CONSTRAINT "_follow_A_fkey";

-- DropForeignKey
ALTER TABLE "_follow" DROP CONSTRAINT "_follow_B_fkey";

-- DropTable
DROP TABLE "_follow";

-- CreateTable
CREATE TABLE "Follow" (
    "followId" TEXT NOT NULL,
    "followedById" TEXT NOT NULL,
    "followingId" TEXT NOT NULL,

    CONSTRAINT "Follow_pkey" PRIMARY KEY ("followId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Follow_followedById_followingId_key" ON "Follow"("followedById", "followingId");

-- AddForeignKey
ALTER TABLE "Follow" ADD CONSTRAINT "Follow_followedById_fkey" FOREIGN KEY ("followedById") REFERENCES "User"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Follow" ADD CONSTRAINT "Follow_followingId_fkey" FOREIGN KEY ("followingId") REFERENCES "User"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;
