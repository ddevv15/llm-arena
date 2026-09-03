import "server-only";
import { prisma } from "@/lib/prisma";
import {
  rankLeaderboard,
  toLeaderboardRows,
  type RankedLeaderboard,
} from "@/lib/leaderboard-view";

/**
 * Reads behind the leaderboard. The arithmetic lives in
 * `lib/leaderboard-view.ts`; this file only fetches what it needs.
 */

const judgedTurnSelect = {
  vote: { select: { answerId: true } },
  answers: {
    where: { status: "COMPLETE" },
    select: { id: true, model: true },
  },
} as const;

/** Every judged contest in the arena. */
export async function getGlobalLeaderboard(): Promise<RankedLeaderboard> {
  const turns = await prisma.turn.findMany({
    where: { vote: { isNot: null } },
    select: judgedTurnSelect,
  });

  return rankLeaderboard(toLeaderboardRows(turns));
}

/**
 * Only the contests this person judged themselves.
 *
 * Keyed on who cast the vote rather than who owns the thread. Today those are
 * always the same person — the vote route refuses a turn the caller doesn't
 * own — but "models I picked between" is the question this board answers, and
 * it stays true if voting on someone else's shared thread is ever allowed.
 */
export async function getPersonalLeaderboard(
  userId: string,
): Promise<RankedLeaderboard> {
  const turns = await prisma.turn.findMany({
    where: { vote: { userId } },
    select: judgedTurnSelect,
  });

  return rankLeaderboard(toLeaderboardRows(turns));
}
