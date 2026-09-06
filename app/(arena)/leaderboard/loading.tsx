import { LeaderboardIntro } from "@/components/leaderboard-intro";
import { PageBar } from "@/components/page-bar";
import { SkeletonLine } from "@/components/skeleton";

/**
 * The leaderboard, arriving.
 *
 * The intro copy is the real copy, not a grey version of it — none of it
 * depends on a vote, so there is nothing honest about hiding it. What is
 * genuinely unknown is which models are on the board and how they did, and
 * that is the only part drawn as bars.
 *
 * Five rows because the free-tier catalog is small and a full board sits near
 * there. The rate bar's track is real and its fill is absent, which is exactly
 * true: the track will be that width, the fill is the number being read.
 */
export default function Loading() {
  return (
    <>
      <PageBar title="Leaderboard" />
      <main className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-3xl flex-col gap-10 px-4 py-12">
          <LeaderboardIntro />

          <section role="status" className="flex flex-col gap-4">
            <span className="sr-only">Loading the leaderboard</span>
            <h2 className="font-display text-lg font-medium">Everyone</h2>

            <div className="flex flex-col">
              {[0, 1, 2, 3, 4].map((row) => (
                <LeaderboardRowSkeleton key={row} />
              ))}
            </div>
          </section>
        </div>
      </main>
    </>
  );
}

function LeaderboardRowSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="grid grid-cols-[1.5rem_1fr_auto] items-baseline gap-x-4 gap-y-2 border-b border-border px-3 py-4 last:border-b-0"
    >
      <SkeletonLine className="h-3 w-3" />
      <SkeletonLine className="h-3 w-48 max-w-full" />
      <SkeletonLine className="h-5 w-28" />
      <div className="col-start-2 col-end-4 h-1 w-full overflow-hidden rounded-xs bg-secondary" />
    </div>
  );
}
