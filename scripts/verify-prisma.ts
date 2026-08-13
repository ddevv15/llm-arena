import "dotenv/config";
import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const userCount = await prisma.user.count();
  console.log(`✅ Connected (found ${userCount} user${userCount === 1 ? "" : "s"})`);
}

main()
  .catch((error) => {
    console.error("❌ Failed to connect:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
