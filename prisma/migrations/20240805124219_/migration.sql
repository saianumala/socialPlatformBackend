/*
  Warnings:

  - Added the required column `commentDescription` to the `comment` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "comment" ADD COLUMN     "commentDescription" TEXT NOT NULL;
