import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { WinExpression, WinRateBar } from "@/components/win-record";
import {
  getGlobalLeaderboard,
  getPersonalLeaderboard,
} from "@/lib/leaderboard";
import {
  MIN_CONTESTS,
  type LeaderboardRow,
  type RankedLeaderboard,
} from "@/lib/leaderboard-view";
import { getModelCatalog } from "@/lib/model-catalog";

export const metadata: Metadata = { title: "Leaderboard" };

/**
 * Which model is actually worth using, by the votes people cast.
 *
 * Public, like `/models` — the whole point of collecting votes is an honest
 * answer anyone can read. The personal board only renders for someone signed
 * in, because a signed-out reader has no votes and an empty second table would
 * be noise rather than information.
 *
 * Deliberately no speed or time-to-first-token columns this round. Both are
 * measured in a way scope.md #6 already records as misleading — `ttft` starts
 * at the first text delta, so a model that reasons first reads as 116 seconds
 * — and averaging a wrong number across models, then ranking by it, would be
 * exactly the invented score this feature says never to show. The page says so
 * rather than quietly omitting them.
 */

/** Display name for a model id, falling back to the id itself. */
function nameOf(catalog: readonly { id: string; name: string }[], id: string) {
  return catalog.find((model) => model.id === id)?.name ?? id;
}

type BoardProps = {
  readonly heading: string;
  readonly board: RankedLeaderboard;
  readonly catalog: readonly { id: string; name: string }[];
  readonly empty: React.ReactNode;
};

function Board({ heading, board, catalog, empty }: BoardProps) {
  const hasAny = board.ranked.length > 0 || board.provisional.length > 0;

  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-display text-lg font-medium">{heading}</h2>
      {!hasAny ? (
        empty
      ) : (
        <>
          {board.ranked.length > 0 && (
            <ol className="flex flex-col">
              {board.ranked.map((row, index) => (
                <RankedRow
                  key={row.model}
                  row={row}
                  rank={index + 1}
                  name={nameOf(catalog, row.model)}
                  first={index === 0}
                />
              ))}
            </ol>
          )}
          {board.provisional.length > 0 && (
            <div
              className={
                board.ranked.length > 0
                  ? "flex flex-col gap-2 border-t border-dashed border-border pt-4"
                  : "flex flex-col gap-2"
              }
            >
              <p className="text-sm text-muted-foreground">
                Not enough votes yet — a model needs {MIN_CONTESTS} judged
                rounds before a win rate means anything.
              </p>
              <ul className="flex flex-col">
                {board.provisional.map((row) => (
                  <ProvisionalRow
                    key={row.model}
                    row={row}
                    name={nameOf(catalog, row.model)}
                  />
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function RankedRow({
  row,
  rank,
  name,
  first,
}: {
  readonly row: LeaderboardRow;
  readonly rank: number;
  readonly name: string;
  readonly first: boolean;
}) {
  return (
    <li
      className={[
        "grid grid-cols-[1.5rem_1fr_auto] items-baseline gap-x-4 gap-y-2 border-b border-border px-3 py-4 last:border-b-0",
        // First place is marked with a fill, not the accent: rust is reserved
        // for interactive things and the bar, and green means "won this turn".
        first && "bg-card",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <span
        aria-hidden="true"
        className="font-mono text-sm text-muted-foreground"
      >
        {rank}
      </span>
      <span className="font-medium">{name}</span>
      {/* The expression is real text and reads correctly on its own, so there
          is no sr-only duplicate here — unlike the sidebar chip, which shows
          "4/5" beside an initial and needs the long form spelled out. */}
      <WinExpression wins={row.wins} of={row.contests} />
      <div className="col-start-2 col-end-4">
        <WinRateBar wins={row.wins} of={row.contests} />
      </div>
    </li>
  );
}

/**
 * No bar here, on purpose. A filled bar on a model that won its only contest
 * would read as mastery; withholding it says "there isn't a rate yet" more
 * honestly than drawing one.
 */
function ProvisionalRow({
  row,
  name,
}: {
  readonly row: LeaderboardRow;
  readonly name: string;
}) {
  return (
    <li className="flex items-baseline justify-between gap-4 border-b border-border py-2 text-muted-foreground last:border-b-0">
      <span>{name}</span>
      <span className="font-mono text-sm">
        won {row.wins} of {row.contests}
      </span>
    </li>
  );
}

export default async function LeaderboardPage() {
  const [{ userId }, catalog, global] = await Promise.all([
    auth(),
    getModelCatalog(),
    getGlobalLeaderboard(),
  ]);

  const personal = userId ? await getPersonalLeaderboard(userId) : null;

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-10 px-4 py-12">
      <div className="flex flex-col gap-2">
        <Link href="/" className="font-display text-xl font-medium">
          LLM Arena
        </Link>
        <h1 className="font-display text-2xl font-medium">Leaderboard</h1>
        <p className="max-w-prose text-muted-foreground">
          Which model wins when someone picks between real answers to the same
          prompt. A model is only counted in rounds it actually answered and
          someone voted on.
        </p>
        <p className="max-w-prose text-sm text-muted-foreground">
          Speed and time-to-first-token aren&apos;t here yet. Both are currently
          measured in a way that misreports models which reason before
          answering, and a wrong number averaged across models would be worse
          than no number.
        </p>
      </div>

      <Board
        heading="Everyone"
        board={global}
        catalog={catalog}
        empty={
          <p className="max-w-prose text-muted-foreground">
            Nobody has voted yet. Send a prompt to two or three models, pick the
            answer you&apos;d actually use, and the first result shows up here.
          </p>
        }
      />

      {personal && (
        <Board
          heading="Your votes"
          board={personal}
          catalog={catalog}
          empty={
            <p className="max-w-prose text-muted-foreground">
              You haven&apos;t picked a winner yet. Once you vote on a turn,
              your own record appears here alongside everyone else&apos;s.
            </p>
          }
        />
      )}
    </main>
  );
}
