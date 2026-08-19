import { auth } from "@clerk/nextjs/server";
import type { ModelMessage } from "ai";
import { streamText } from "ai";
import { z } from "zod";
import { isFreeModel } from "@/lib/models";
import { openrouter } from "@/lib/openrouter";
import { toModelSseResponse } from "@/lib/model-stream";
import { prisma } from "@/lib/prisma";

const requestSchema = z.object({
  turnId: z.string().min(1),
  answerId: z.string().min(1),
});

const humanError = (message: string, status: number) =>
  Response.json({ error: message }, { status });

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return humanError("Sign in to send a prompt.", 401);
  }

  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return humanError("That prompt couldn't be sent. Try again.", 400);
  }

  const { turnId, answerId } = parsed.data;

  const answer = await prisma.modelAnswer.findUnique({
    where: { id: answerId },
    select: {
      model: true,
      status: true,
      turn: {
        select: {
          id: true,
          prompt: true,
          threadId: true,
          createdAt: true,
          thread: { select: { userId: true } },
        },
      },
    },
  });

  if (
    !answer ||
    answer.turn.id !== turnId ||
    answer.turn.thread.userId !== userId
  ) {
    return humanError("That turn couldn't be found.", 404);
  }

  if (answer.status !== "STREAMING") {
    return humanError("This model has already answered this turn.", 409);
  }

  if (!isFreeModel(answer.model)) {
    return humanError("That model isn't available anymore.", 400);
  }

  // Each model continues its own conversation: only turns where *this* model
  // completed an answer count toward its history, so one model erroring on a
  // turn doesn't leave a gap the others don't also have to work around.
  const earlierTurns = await prisma.turn.findMany({
    where: {
      threadId: answer.turn.threadId,
      createdAt: { lt: answer.turn.createdAt },
    },
    orderBy: { createdAt: "asc" },
    select: {
      prompt: true,
      answers: {
        where: { model: answer.model, status: "COMPLETE" },
        select: { content: true },
        take: 1,
      },
    },
  });

  const messages: ModelMessage[] = earlierTurns.flatMap((turn) =>
    turn.answers[0]
      ? [
          { role: "user" as const, content: turn.prompt },
          { role: "assistant" as const, content: turn.answers[0].content },
        ]
      : [],
  );
  messages.push({ role: "user", content: answer.turn.prompt });

  const requestStart = performance.now();
  const result = streamText({
    model: openrouter().chat(answer.model),
    messages,
  });

  return toModelSseResponse(result, requestStart, {
    onSettled: async (outcome) => {
      await prisma.modelAnswer.update({
        where: { id: answerId },
        data:
          outcome.status === "COMPLETE"
            ? {
                status: "COMPLETE",
                content: outcome.content,
                ttft: outcome.ttft,
                tokensPerSecond: outcome.tokensPerSecond,
                outputTokens: outcome.outputTokens,
              }
            : { status: "ERROR" },
      });
    },
  });
}
