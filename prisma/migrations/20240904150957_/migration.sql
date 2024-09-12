/*
  Warnings:

  - You are about to drop the column `profilePicture` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `image` on the `post` table. All the data in the column will be lost.
  - Added the required column `profilePictureURL` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "post_image_key";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "profilePicture",
ADD COLUMN     "profilePictureURL" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "post" DROP COLUMN "image",
ALTER COLUMN "contentType" DROP DEFAULT,
ALTER COLUMN "contentURL" DROP DEFAULT;
