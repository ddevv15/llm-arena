import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { aj } from "@/lib/arcjet";
import { FREE_MODEL_IDS, type FreeModelId } from "@/lib/models";
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

/** What the client needs back: the turn, and one row per model to stream. */
const TURN_SELECT = {
  id: true,
  answers: { select: { id: true, model: true } },
} as const;

/**
 * Prisma's "an update matched no row". Checked structurally rather than by
 * importing the error class, which lives in the generated client and would tie
 * this route to that import path for one string comparison.
 */
const isMissingRecord = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  error.code === "P2025";

type NewTurn = {
  readonly userId: string;
  readonly prompt: string;
  readonly models: readonly FreeModelId[];
};

/**
 * A follow-up in a thread that already exists.
 *
 * Ownership is the `where` clause, not a query ahead of it. The old shape read
 * the thread, compared `userId` in JS, and only then opened the transaction —
 * a whole round trip whose entire output was a boolean the database could just
 * as well have enforced. A thread that isn't this user's now matches nothing
 * and Prisma raises `P2025`, which the caller turns into the same 404.
 *
 * The `updatedAt` bump is still explicit and still has to be: the sidebar
 * orders by it, and Prisma's `@updatedAt` doesn't fire when a child `Turn` is
 * created.
 */
async function appendTurn({
  userId,
  threadId,
  prompt,
  models,
}: NewTurn & { readonly threadId: string }) {
  return prisma.$transaction(async (tx) => {
    const thread = await tx.thread.update({
      where: { id: threadId, userId },
      data: { updatedAt: new Date() },
      select: { id: true, title: true },
    });

    const turn = await tx.turn.create({
      data: {
        threadId: thread.id,
        prompt,
        answers: { create: models.map((model) => ({ model })) },
      },
      select: TURN_SELECT,
    });

    return { thread, turn };
  });
}

/**
 * The first prompt of a brand-new thread — user row, thread, turn and answers
 * in a single statement.
 *
 * `connectOrCreate` is doing real work here. `Thread.userId` and `Vote.userId`
 * both carry a foreign key to `User`, but nothing in the Clerk sign-in flow
 * ever writes that row, so this is the first place a signed-in user's id is
 * used for a write and it has to create the row on first use. It used to be a
 * separate `upsert` inside the transaction, which meant three statements to
 * say one thing.
 */
async function startThread({ userId, prompt, models }: NewTurn) {
  const { thread, ...turn } = await prisma.turn.create({
    data: {
      prompt,
      answers: { create: models.map((model) => ({ model })) },
      thread: {
        create: {
          title: titleFromPrompt(prompt),
          user: {
            connectOrCreate: { where: { id: userId }, create: { id: userId } },
          },
        },
      },
    },
    select: { ...TURN_SELECT, thread: { select: { id: true, title: true } } },
  });

  return { thread, turn };
}

export async function POST(request: Request) {
  // Independent work, so it runs at the same time. `auth()` reads headers and
  // cookies; parsing the body touches neither. Awaiting them one after the
  // other was two waits for the price of one piece of information.
  const [{ userId }, body] = await Promise.all([
    auth(),
    request.json().catch(() => null),
  ]);

  if (!userId) {
    return humanError("Sign in to send a prompt.", 401);
  }

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

  try {
    const { thread, turn } = threadId
      ? await appendTurn({ userId, threadId, prompt, models })
      : await startThread({ userId, prompt, models });

    // `threadTitle` is here so the sidebar can show a brand-new thread the
    // moment it exists, without a round trip to re-read the list it just
    // caused to change.
    return Response.json({
      threadId: thread.id,
      threadTitle: thread.title,
      turnId: turn.id,
      answers: turn.answers,
    });
  } catch (error) {
    // The only expected failure: `appendTurn`'s `where` matched no row, which
    // means the thread is gone or was never this user's. Both are a 404 —
    // threads are link-public, so there is nothing left to conceal by
    // collapsing the two, and feature #8 already settled that a 404 means
    // genuinely absent.
    if (isMissingRecord(error)) {
      return humanError("That thread couldn't be found.", 404);
    }
    throw error;
  }
}
