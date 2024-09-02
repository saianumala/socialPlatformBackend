/*
  Warnings:

  - A unique constraint covering the columns `[likedByUsername,postId]` on the table `like` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "like_likedByUsername_postId_key" ON "like"("likedByUsername", "postId");
