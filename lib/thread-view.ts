import { MAX_SELECTED_MODELS, type FreeModelId } from "@/lib/models";

/**
 * The shape a thread takes once it leaves the database and heads for the UI,
 * plus the pure derivations over it.
 *
 * Deliberately separate from `lib/threads.ts`: that module imports Prisma and
 * can only ever run on the server, while everything here is needed on both
 * sides — the thread page reads it, and the client re-derives from it live as
 * answers stream in and votes land.
 */

export type AnswerStatus = "STREAMING" | "COMPLETE" | "ERROR";

// `model` is a plain string, not `FreeModelId`: it's whatever was stored when
// the answer was written, and the free-tier allowlist can change underneath a
// thread that's already on disk. Narrowing back to `FreeModelId` happens at
// the point it actually matters — deciding what to ask next.
export type StoredAnswer = {
  readonly id: string;
  readonly model: string;
  readonly status: AnswerStatus;
  readonly content: string;
  readonly ttft: number | null;
  readonly tokensPerSecond: number | null;
  readonly outputTokens: number | null;
};

export type StoredTurn = {
  readonly id: string;
  readonly prompt: string;
  readonly answers: readonly StoredAnswer[];
  readonly voteAnswerId: string | null;
};

export type ThreadSummary = {
  readonly id: string;
  readonly title: string;
  readonly lastActive: string;
};

export type ThreadDetail = {
  readonly id: string;
  readonly title: string;
  readonly turns: readonly StoredTurn[];
};

/**
 * Who is looking at a thread.
 *
 * Three states rather than one `isOwner` boolean, because the two non-owner
 * cases genuinely differ on screen: a signed-in visitor still has their own
 * thread list to navigate and their own arena to start, while a signed-out
 * one has neither and needs a way in.
 *
 * Deliberately a role, not the owner's user id — the owner's Clerk id has no
 * business being serialized into a page anyone on the internet can open.
 */
export type ViewerRole = "owner" | "visitor" | "anonymous";

export type WinRecord = {
  readonly model: string;
  readonly wins: number;
  /** Turns this model actually answered in — the denominator of `wins`. */
  readonly answered: number;
};

/**
 * Per-model record for one thread's turns, in the order each model first
 * appears in the thread so the chips don't reshuffle as votes land.
 *
 * A ratio, not a bare tally, because "1" alone doesn't say whether a model won
 * once out of two or once out of twenty. `answered` counts the turns a model
 * took part in rather than every turn in the thread, since a model added
 * halfway through hasn't lost the rounds it was never in.
 *
 * Derived rather than counted: the top bar and the answer panels then can't
 * disagree, because there is only one number and it's computed from the same
 * turns the panels render.
 */
// Structural on purpose: the server hands this stored turns, the client hands
// it turns whose answers carry an extra client-only status. Both have the two
// fields a win record actually needs.
type WinRecordSource = {
  readonly voteAnswerId: string | null;
  readonly answers: readonly { readonly id: string; readonly model: string }[];
};

export function deriveWinRecords(
  turns: readonly WinRecordSource[],
): WinRecord[] {
  const wins = turns.reduce<ReadonlyMap<string, number>>((tally, turn) => {
    const winner = turn.answers.find(
      (answer) => answer.id === turn.voteAnswerId,
    );
    return winner
      ? new Map(tally).set(winner.model, (tally.get(winner.model) ?? 0) + 1)
      : tally;
  }, new Map<string, number>());

  // One turn counts once per model even if that model somehow has two rows in
  // it, so the denominator can never exceed the number of turns.
  const answered = turns.reduce<ReadonlyMap<string, number>>(
    (tally, turn) =>
      [...new Set(turn.answers.map((answer) => answer.model))].reduce(
        (inner, model) =>
          new Map(inner).set(model, (inner.get(model) ?? 0) + 1),
        tally,
      ),
    new Map<string, number>(),
  );

  const seen = turns.flatMap((turn) => turn.answers.map((a) => a.model));

  return [...new Set(seen)].map((model) => ({
    model,
    wins: wins.get(model) ?? 0,
    answered: answered.get(model) ?? 0,
  }));
}

/** The provider half of an OpenRouter id — `nvidia/nemotron-3-ultra:free`. */
const providerOf = (id: string): string => id.split("/")[0] ?? id;

/**
 * What a brand-new thread opens with: three models from three different
 * providers.
 *
 * Sorting by context window alone kept handing back two NVIDIA models, which
 * makes for a poor comparison — two models from one house tend to share a
 * lineage, and the point of the arena is to watch genuinely different systems
 * answer the same prompt. So this walks the catalog in its existing order
 * (already sorted, so the biggest context window still wins within a provider)
 * and takes the first model from each provider it hasn't used yet.
 *
 * If there aren't enough distinct providers to fill the three slots, it tops
 * up with whatever is left rather than returning a short list — two panels
 * from one provider beats one empty column.
 */
export function selectDefaultModels(
  availableIds: readonly FreeModelId[],
  limit: number = MAX_SELECTED_MODELS,
): FreeModelId[] {
  const firstPerProvider = availableIds.reduce<{
    readonly picked: readonly FreeModelId[];
    readonly providers: ReadonlySet<string>;
  }>(
    (state, id) =>
      state.providers.has(providerOf(id)) || state.picked.length >= limit
        ? state
        : {
            picked: [...state.picked, id],
            providers: new Set([...state.providers, providerOf(id)]),
          },
    { picked: [], providers: new Set<string>() },
  ).picked;

  const topUp = availableIds.filter((id) => !firstPerProvider.includes(id));

  return [...firstPerProvider, ...topUp].slice(0, limit);
}

/**
 * Which models a thread should open with pre-selected.
 *
 * Feature #5 defaults a brand-new thread to the top three models by context
 * window. Re-opening an existing thread is a different situation: the thread
 * already has three conversations in flight, and each model's history only
 * continues if that same model is asked again.
 *
 * `availableIds` is the live catalog — a model that answered here months ago
 * may no longer be on the free tier, and asking for it would be rejected by
 * `/api/chat`'s allowlist check.
 */
export function selectInitialModels(
  turns: readonly StoredTurn[],
  availableIds: readonly FreeModelId[],
  fallbackIds: readonly FreeModelId[],
): FreeModelId[] {
  const available = new Set<string>(availableIds);

  // The last turn's selection, and only that one. A thread's selection can
  // change between turns, and the most recent one is the live answer to "what
  // is this thread asking right now".
  //
  // Deliberately not a union across the whole thread topped up to three: if a
  // model was asked in turn one and dropped before turn two, reinstating it
  // here would silently undo a removal the person made on purpose, and put a
  // stale conversation back in front of them.
  //
  // A model that errored still counts. The row exists, that model was asked,
  // and this restores a selection, not a record of who succeeded.
  const lastTurn = turns[turns.length - 1];

  const restored = lastTurn
    ? [...new Set(lastTurn.answers.map((answer) => answer.model))]
        .filter((model): model is FreeModelId => available.has(model))
        .slice(0, MAX_SELECTED_MODELS)
    : [];

  // Both empty cases are real: a brand-new thread has no turns at all, and an
  // old one can have every model it used dropped from the free tier since. The
  // picker still has to open with something usable either way.
  return restored.length > 0 ? restored : [...fallbackIds];
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

/**
 * The timestamp under every thread in the sidebar.
 *
 * Formatted on the server and passed down as a finished string, so the markup
 * the client hydrates against is identical to what was rendered — computing
 * "3 minutes ago" independently on both sides is a hydration mismatch waiting
 * to happen, since the two clocks are never quite the same.
 */
export function formatLastActive(updatedAt: Date, now: Date): string {
  const elapsed = now.getTime() - updatedAt.getTime();

  if (elapsed < MINUTE) {
    return "Just now";
  }
  if (elapsed < HOUR) {
    return `${Math.floor(elapsed / MINUTE)} min ago`;
  }
  if (elapsed < DAY) {
    return `${Math.floor(elapsed / HOUR)} hr ago`;
  }
  if (elapsed < WEEK) {
    const days = Math.floor(elapsed / DAY);
    return days === 1 ? "Yesterday" : `${days} days ago`;
  }

  // Past a week, "37 days ago" stops meaning anything a person can place. An
  // actual date does.
  return updatedAt.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}
