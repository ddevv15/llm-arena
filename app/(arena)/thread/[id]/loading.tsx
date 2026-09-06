import {
  ComposerSkeleton,
  TopBarSkeleton,
  TurnSkeleton,
} from "@/components/skeleton";

/**
 * A thread, arriving.
 *
 * One turn frame, not a guess at how many. The number of turns is the thing
 * this page is about to find out, and drawing five frames for a one-turn thread
 * would collapse visibly the moment the real content lands. One is the only
 * count that is certainly not too many.
 */
export default function Loading() {
  return (
    <>
      <TopBarSkeleton />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div
          role="status"
          className="mx-auto flex h-full max-w-6xl flex-col px-4 py-8"
        >
          <span className="sr-only">Loading this thread</span>

          <div className="flex flex-1 flex-col gap-10">
            <TurnSkeleton />
          </div>

          <div className="pt-8 pb-4">
            <ComposerSkeleton />
          </div>
        </div>
      </div>
    </>
  );
}
