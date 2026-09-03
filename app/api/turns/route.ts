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

  // Fail closed where an error is visible — but this is best effort, not a
  // guarantee, and the difference was measured rather than assumed.
  //
  // With Arcjet pointed at an unreachable address, most requests came back
  // `conclusion: ALLOW` with every rule reporting ALLOW, prompt injection
  // included, which plainly could not have run. No error surfaced anywhere on
  // the decision: not on `isErrored()`, not on any per-rule result. So an
  // outage is, in that mode, indistinguishable from a clean pass, and no code
  // here can close that gap.
  //
  // What this does catch is the error Arcjet *does* report — a timed-out or
  // refused decision — and on this route that is worth a 503 rather than a
  // silent pass, because it is where a prompt enters the system, gets written
  // down, and reaches a model. The public read page makes the opposite call.
  //
  // The real defence against the silent case is upstream: `aj` is given a
  // deadline long enough that ordinary latency never lands here. See the note
  // on `WRITE_DECISION_TIMEOUT_MS` — before that, this branch was rejecting
  // roughly half of all prompts on latency alone.
  if (decision.isErrored()) {
    console.error("Arcjet decision errored on a turn write", {
      message: decision.reason.message,
    });
    return humanError(
      "That prompt couldn't be sent right now. Try again in a moment.",
      503,
    );
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

  const result = await prisma.$transaction(async (tx) => {
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

    // The sidebar orders by `Thread.updatedAt`, and creating a child `Turn`
    // doesn't touch the parent row on its own — Prisma's `@updatedAt` only
    // fires on a write to the thread itself. A thread that was just used has
    // to say so, so bump it here, in the same transaction as the turn.
    const thread = threadId
      ? await tx.thread.update({
          where: { id: threadId },
          data: { updatedAt: new Date() },
          select: { id: true, title: true },
        })
      : await tx.thread.create({
          data: { userId, title: titleFromPrompt(prompt) },
          select: { id: true, title: true },
        });

    const turn = await tx.turn.create({
      data: {
        threadId: thread.id,
        prompt,
        answers: {
          create: models.map((model) => ({ model })),
        },
      },
      select: {
        id: true,
        answers: { select: { id: true, model: true } },
      },
    });

    return { thread, turn };
  });

  // `threadTitle` is here so the sidebar can show a brand-new thread the
  // moment it exists, without a round trip to re-read the list it just
  // caused to change.
  return Response.json({
    threadId: result.thread.id,
    threadTitle: result.thread.title,
    turnId: result.turn.id,
    answers: result.turn.answers,
  });
}
