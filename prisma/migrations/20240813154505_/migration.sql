-- DropForeignKey
ALTER TABLE "Follow" DROP CONSTRAINT "Follow_followedByUsername_fkey";

-- DropForeignKey
ALTER TABLE "Follow" DROP CONSTRAINT "Follow_followingUsername_fkey";

-- AddForeignKey
ALTER TABLE "Follow" ADD CONSTRAINT "Follow_followedByUsername_fkey" FOREIGN KEY ("followedByUsername") REFERENCES "User"("username") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Follow" ADD CONSTRAINT "Follow_followingUsername_fkey" FOREIGN KEY ("followingUsername") REFERENCES "User"("username") ON DELETE RESTRICT ON UPDATE CASCADE;
