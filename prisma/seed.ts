import "dotenv/config";
import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

// Not a real Clerk id — local/dev seed data only, so the whole graph
// (thread → turn → two answers → vote) can be exercised without a real
// signed-in session.
const DEMO_USER_ID = "seed-demo-user";

async function main() {
  const user = await prisma.user.upsert({
    where: { id: DEMO_USER_ID },
    update: {},
    create: { id: DEMO_USER_ID },
  });

  const thread = await prisma.thread.create({
    data: {
      userId: user.id,
      title: "Which model explains recursion best?",
      turns: {
        create: {
          prompt: "Explain recursion in one paragraph.",
          answers: {
            create: [
              {
                model: "openai/gpt-oss-20b:free",
                status: "COMPLETE",
                content: "Recursion is a function that calls itself...",
                ttft: 320,
                tokensPerSecond: 42.5,
                outputTokens: 96,
              },
              {
                model: "nvidia/nemotron-nano-9b-v2:free",
                status: "COMPLETE",
                content: "A recursive function solves a problem by...",
                ttft: 410,
                tokensPerSecond: 38.1,
                outputTokens: 88,
              },
            ],
          },
        },
      },
    },
    include: { turns: { include: { answers: true } } },
  });

  const [turn] = thread.turns;
  const [winningAnswer] = turn.answers;

  const vote = await prisma.vote.upsert({
    where: { turnId: turn.id },
    update: {},
    create: {
      turnId: turn.id,
      userId: user.id,
      answerId: winningAnswer.id,
    },
  });

  console.log(
    `Seeded user ${user.id}, thread "${thread.title}" with ${turn.answers.length} answers, vote ${vote.id} for answer ${vote.answerId}`,
  );
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
