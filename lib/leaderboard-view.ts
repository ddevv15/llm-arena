/**
 * How the leaderboard's numbers are derived. Pure, no database.
 *
 * One rule decides everything here: a model's denominator is the number of
 * *judged contests it competed in*, not the number of turns it answered.
 *
 * That is deliberately not what `deriveWinRecords` in `lib/thread-view.ts`
 * counts, and the two should not be merged. A thread's chips answer "how has
 * this model done in this conversation", so every turn it took part in belongs
 * in the denominator. A leaderboard answers "which model is actually worth
 * using", and turns nobody voted on carry no information about that — counting
 * them would print "won 4 of 500" for a model that was only ever judged ten
 * times, which reads as a terrible model rather than a thin sample.
 *
 * So a contest is a turn that has a vote *and* in which this model produced a
 * COMPLETE answer. A model that errored never entered the contest and is not
 * charged a loss for it: that is a reliability problem, and this is a win rate.
 *
 * Split from `lib/leaderboard.ts` for the same reason `lib/thread-view.ts` is
 * split from `lib/threads.ts`: the queries are `server-only`, and colocating
 * these with them made the arithmetic impossible to exercise on its own.
 */

/** A judged turn, reduced to just what a win rate needs. */
export type JudgedTurn = {
  readonly vote: { readonly answerId: string } | null;
  readonly answers: readonly { readonly id: string; readonly model: string }[];
};

export type LeaderboardRow = {
  readonly model: string;
  readonly wins: number;
  /** Judged contests this model completed an answer in. Never zero. */
  readonly contests: number;
};

/**
 * How many judged contests a model needs before it is ranked at all.
 *
 * Without a floor, one lucky 1-of-1 sits above a model that won 40 of 50, and
 * the first-place highlight becomes a lie. Models below it are still shown —
 * hiding them would misrepresent what the arena has actually tried — just held
 * apart and not ranked.
 */
export const MIN_CONTESTS = 5;

const dedupe = (values: readonly string[]): readonly string[] => [
  ...new Set(values),
];

/**
 * Turn judged turns into one row per model. Pure, so the numbers can be
 * reasoned about without a database.
 */
export function toLeaderboardRows(
  turns: readonly JudgedTurn[],
): readonly LeaderboardRow[] {
  const tally = turns.reduce<ReadonlyMap<string, LeaderboardRow>>(
    (acc, turn) => {
      const winningModel = turn.answers.find(
        (answer) => answer.id === turn.vote?.answerId,
      )?.model;

      // One turn counts once per model even if a model somehow has two rows in
      // it, so a contest can never be double-counted.
      return dedupe(turn.answers.map((answer) => answer.model)).reduce(
        (inner, model) => {
          const current = inner.get(model) ?? { model, wins: 0, contests: 0 };
          return new Map(inner).set(model, {
            model,
            wins: current.wins + (model === winningModel ? 1 : 0),
            contests: current.contests + 1,
          });
        },
        acc,
      );
    },
    new Map<string, LeaderboardRow>(),
  );

  return [...tally.values()];
}

/** Win rate as a fraction. Used for ordering and bar width, never printed raw. */
export const winRate = (row: LeaderboardRow): number =>
  row.contests === 0 ? 0 : row.wins / row.contests;

export type RankedLeaderboard = {
  /** Enough evidence to be ranked. First entry is first place. */
  readonly ranked: readonly LeaderboardRow[];
  /** Shown, but not ranked — too few judged contests to mean anything yet. */
  readonly provisional: readonly LeaderboardRow[];
};

/**
 * Split and order. Ties break on the number of contests, so that between two
 * models with the same rate the one with more evidence behind it wins — then
 * on the model id, so the order is stable across renders rather than depending
 * on map insertion.
 */
export function rankLeaderboard(
  rows: readonly LeaderboardRow[],
): RankedLeaderboard {
  const byStrength = (a: LeaderboardRow, b: LeaderboardRow): number =>
    winRate(b) - winRate(a) ||
    b.contests - a.contests ||
    a.model.localeCompare(b.model);

  return {
    ranked: rows.filter((row) => row.contests >= MIN_CONTESTS).sort(byStrength),
    provisional: rows
      .filter((row) => row.contests < MIN_CONTESTS)
      .sort(
        (a, b) => b.contests - a.contests || a.model.localeCompare(b.model),
      ),
  };
}
