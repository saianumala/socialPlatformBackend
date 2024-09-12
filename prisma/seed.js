const { PrismaClient } = require("@prisma/client");
const uuidv4 = require("uuid");
const bcryptjs = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  const users = Array.from({ length: 20 }).map((_, i) => {
    const random = Math.random() * 10 + 1;
    const hashedPassword = bcryptjs.hashSync("12345678", 10);

    return {
      username: `user${i + 1}`,
      email: `user${i + 1}@example.com`,
      password: hashedPassword,
      profilePictureURL:
        "https://res.cloudinary.com/do0hnur2n/image/upload/v1725256558/default_he33fg.png",
      isVerified: true,
      verifyToken: null,
      VerificationExpiry: null,
    };
  });

  await prisma.user.createMany({
    data: users,
  });

  console.log("Seed data created successfully!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
