import "dotenv/config";
import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const [userCount, threadCount, turnCount, answerCount, voteCount] =
    await Promise.all([
      prisma.user.count(),
      prisma.thread.count(),
      prisma.turn.count(),
      prisma.modelAnswer.count(),
      prisma.vote.count(),
    ]);

  console.log(
    `✅ Connected (users: ${userCount}, threads: ${threadCount}, turns: ${turnCount}, answers: ${answerCount}, votes: ${voteCount})`,
  );
}

main()
  .catch((error) => {
    console.error("❌ Failed to connect:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
