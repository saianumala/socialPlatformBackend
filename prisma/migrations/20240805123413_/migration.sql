/*
  Warnings:

  - A unique constraint covering the columns `[commentedByUsername,postId]` on the table `comment` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "comment_commentedByUsername_postId_key" ON "comment"("commentedByUsername", "postId");
