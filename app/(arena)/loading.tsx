import {
  ComposerSkeleton,
  SkeletonLine,
  TopBarSkeleton,
} from "@/components/skeleton";

/**
 * The new-thread page, arriving.
 *
 * No turn frame here, unlike the thread route: this page opens on an empty
 * arena, and drawing three answer columns that are about to be replaced by a
 * headline would be a skeleton that lies about what is coming.
 *
 * The sidebar is absent on purpose — it belongs to the layout now, and stays
 * on screen while this renders.
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
          <span className="sr-only">Loading the arena</span>

          <div className="flex flex-1 flex-col items-center justify-center gap-3">
            <SkeletonLine className="h-6 w-72 max-w-full" />
            <SkeletonLine className="h-3 w-96 max-w-full" />
          </div>

          <div className="pb-4">
            <ComposerSkeleton />
          </div>
        </div>
      </div>
    </>
  );
}
