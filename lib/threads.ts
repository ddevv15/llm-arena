import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import {
  formatLastActive,
  type ThreadDetail,
  type ThreadSummary,
} from "@/lib/thread-view";

/**
 * Reads for the sidebar and the thread page.
 *
 * The two are scoped differently, and that asymmetry is the whole of feature
 * #8. The sidebar is one person's own history, so it stays keyed to a user.
 * A thread itself is readable by anyone holding the link — the schema carries
 * no visibility column because there is nothing to toggle, every thread is
 * link-public by design.
 *
 * That also lets a missing thread mean one honest thing again. The old rule
 * collapsed "not yours" into "doesn't exist" to avoid confirming whether some
 * other person's thread id was real; with threads public, there is nothing
 * left to confirm, so a 404 now means genuinely absent.
 */

const SIDEBAR_THREAD_LIMIT = 50;

/** Every thread this user owns, most recently used first. */
export async function listThreads(userId: string): Promise<ThreadSummary[]> {
  const threads = await prisma.thread.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    take: SIDEBAR_THREAD_LIMIT,
    select: { id: true, title: true, updatedAt: true },
  });

  const now = new Date();

  return threads.map((thread) => ({
    id: thread.id,
    title: thread.title,
    lastActive: formatLastActive(thread.updatedAt, now),
  }));
}

/** A thread plus who owns it. `ownerId` stays server-side — see `ViewerRole`. */
export type ThreadWithOwner = ThreadDetail & { readonly ownerId: string };

/**
 * One thread with its full history, for anyone who has the link, or `null` if
 * there is no such thread.
 *
 * `cache()` because the page and its `generateMetadata` both need it and would
 * otherwise each run this query for a single request.
 *
 * Answers still marked `STREAMING` are returned as-is rather than repaired:
 * feature #6 knowingly leaves a row in that state when a request dies before
 * settling, and the UI says so plainly instead of pretending it errored.
 */
export const getThread = cache(async function getThread(
  threadId: string,
): Promise<ThreadWithOwner | null> {
  const thread = await prisma.thread.findUnique({
    where: { id: threadId },
    select: {
      id: true,
      title: true,
      userId: true,
      turns: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          prompt: true,
          vote: { select: { answerId: true } },
          answers: {
            orderBy: { createdAt: "asc" },
            select: {
              id: true,
              model: true,
              status: true,
              content: true,
              ttft: true,
              tokensPerSecond: true,
              outputTokens: true,
            },
          },
        },
      },
    },
  });

  if (!thread) {
    return null;
  }

  return {
    id: thread.id,
    title: thread.title,
    ownerId: thread.userId,
    turns: thread.turns.map((turn) => ({
      id: turn.id,
      prompt: turn.prompt,
      voteAnswerId: turn.vote?.answerId ?? null,
      answers: turn.answers,
    })),
  };
});
