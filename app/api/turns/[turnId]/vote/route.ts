import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const requestSchema = z.object({
  answerId: z.string().min(1),
});

const humanError = (message: string, status: number) =>
  Response.json({ error: message }, { status });

const MIN_ANSWERED_TO_VOTE = 2;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ turnId: string }> },
) {
  const { userId } = await auth();
  if (!userId) {
    return humanError("Sign in to vote.", 401);
  }

  const { turnId } = await params;

  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return humanError("That vote couldn't be sent. Try again.", 400);
  }

  const { answerId } = parsed.data;

  const turn = await prisma.turn.findUnique({
    where: { id: turnId },
    select: {
      thread: { select: { userId: true } },
      vote: { select: { id: true } },
      answers: { select: { id: true, status: true } },
    },
  });

  if (!turn || turn.thread.userId !== userId) {
    return humanError("That turn couldn't be found.", 404);
  }

  if (turn.vote) {
    return humanError("This turn has already been voted on.", 409);
  }

  const completeAnswers = turn.answers.filter(
    (answer) => answer.status === "COMPLETE",
  );

  if (completeAnswers.length < MIN_ANSWERED_TO_VOTE) {
    return humanError(
      "At least two models need to answer before you can vote.",
      400,
    );
  }

  const votedAnswer = completeAnswers.find((answer) => answer.id === answerId);
  if (!votedAnswer) {
    return humanError("That answer isn't part of this turn.", 400);
  }

  await prisma.vote.create({
    data: { turnId, answerId, userId },
  });

  return Response.json({ turnId, answerId });
}
