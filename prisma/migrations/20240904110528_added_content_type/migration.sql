/*
  Warnings:

  - A unique constraint covering the columns `[contentURL]` on the table `post` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "ContentType" AS ENUM ('image', 'video');

-- AlterTable
ALTER TABLE "post" ADD COLUMN     "contentType" "ContentType" NOT NULL DEFAULT 'image',
ADD COLUMN     "contentURL" TEXT NOT NULL DEFAULT 'ddd';

-- CreateIndex
CREATE UNIQUE INDEX "post_contentURL_key" ON "post"("contentURL");
