import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { aj } from "@/lib/arcjet";
import { FREE_MODEL_IDS } from "@/lib/models";
import { prisma } from "@/lib/prisma";

const requestSchema = z.object({
  prompt: z.string().min(1),
  models: z.array(z.enum(FREE_MODEL_IDS)).min(1).max(3),
  threadId: z.string().min(1).optional(),
});

const MAX_TITLE_LENGTH = 60;

const humanError = (message: string, status: number) =>
  Response.json({ error: message }, { status });

const titleFromPrompt = (prompt: string): string =>
  prompt.length > MAX_TITLE_LENGTH
    ? `${prompt.slice(0, MAX_TITLE_LENGTH).trimEnd()}…`
    : prompt;

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

  const { prompt, models, threadId } = parsed.data;

  const decision = await aj.protect(request, {
    userId,
    requested: 1,
    detectPromptInjectionMessage: prompt,
  });

  if (decision.isDenied()) {
    if (decision.reason.isRateLimit()) {
      return humanError(
        "You're sending prompts faster than we can keep up. Wait a moment and try again.",
        429,
      );
    }
    if (decision.reason.isPromptInjection()) {
      return humanError(
        "That prompt couldn't be sent. Try rephrasing it.",
        400,
      );
    }
    return humanError("That prompt couldn't be sent. Try again.", 403);
  }

  if (threadId) {
    const thread = await prisma.thread.findUnique({
      where: { id: threadId },
      select: { userId: true },
    });
    if (!thread || thread.userId !== userId) {
      return humanError("That thread couldn't be found.", 404);
    }
  }

  const turn = await prisma.$transaction(async (tx) => {
    // `Thread.userId` and `Vote.userId` both carry a foreign key to `User`,
    // but nothing in the Clerk sign-in flow ever writes that row — this is
    // the first place a signed-in user's id is used for a real write, so it
    // has to create the row on first use rather than assume it exists.
    if (!threadId) {
      await tx.user.upsert({
        where: { id: userId },
        create: { id: userId },
        update: {},
      });
    }

    const thread =
      threadId ??
      (
        await tx.thread.create({
          data: { userId, title: titleFromPrompt(prompt) },
        })
      ).id;

    return tx.turn.create({
      data: {
        threadId: thread,
        prompt,
        answers: {
          create: models.map((model) => ({ model })),
        },
      },
      select: {
        id: true,
        threadId: true,
        answers: { select: { id: true, model: true } },
      },
    });
  });

  return Response.json({
    threadId: turn.threadId,
    turnId: turn.id,
    answers: turn.answers,
  });
}
