import { cn } from "@/lib/utils";

/**
 * The arena and the leaderboard, one moment before they have anything to say.
 *
 * The rule these all follow: **draw the structure, mute only the entries.**
 * A ledger's frame, its column hairlines and its footing rule are certain
 * before the query returns — an answer panel is coming, and it will have that
 * shape. Only the words are unknown. So the borders here are the real borders
 * at full strength, and what breathes is exactly the text that isn't there
 * yet. The generic alternative, a screen of grey blocks, would throw away
 * information the app already has and make the swap to real content a visible
 * jump rather than an ink-in.
 *
 * Every piece here is `aria-hidden`; the routes that use them own the single
 * `role="status"` that actually announces the wait.
 */

/** Line widths that read as prose rather than as blocks, in a fixed cycle. */
const PROSE_WIDTHS = ["w-full", "w-11/12", "w-4/5", "w-full", "w-2/3"] as const;

export function SkeletonLine({ className }: { readonly className?: string }) {
  return (
    <span aria-hidden="true" className={cn("skeleton block h-3", className)} />
  );
}

/** A paragraph's worth of unwritten text. */
export function SkeletonProse({
  lines,
  className,
}: {
  readonly lines: number;
  readonly className?: string;
}) {
  return (
    <div aria-hidden="true" className={cn("flex flex-col gap-2", className)}>
      {Array.from({ length: lines }, (_, index) => (
        <SkeletonLine
          key={index}
          className={PROSE_WIDTHS[index % PROSE_WIDTHS.length]}
        />
      ))}
    </div>
  );
}

/**
 * The bar above the arena, at its real height so nothing shifts when the page
 * arrives underneath it.
 */
export function TopBarSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-card px-3 md:px-4"
    >
      <SkeletonLine className="size-5 rounded-md" />
      <SkeletonLine className="h-4 w-40 max-w-[40%]" />
      <span className="flex-1" />
      <SkeletonLine className="h-6 w-14 rounded-full" />
      <SkeletonLine className="h-6 w-14 rounded-full" />
    </div>
  );
}

/**
 * One turn: what was asked, and the ruled frame the answers will fill.
 *
 * Three columns because that is what the arena is for and what most turns
 * hold. It stacks to one below `md` exactly as the real panel does — three
 * columns of prose on a phone is three unreadable columns.
 */
export function TurnSkeleton() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-4">
      {/* The bubble is one block rather than the usual lines-inside-a-shape.
          In light mode `--secondary` and `--muted` are the same value, so
          muted lines on the secondary bubble are literally invisible — and
          the prompt is short enough that its silhouette says everything the
          lines would have. */}
      <SkeletonLine className="ml-auto h-13 w-[55%] max-w-[75%] rounded-md rounded-br-none" />

      <div className="overflow-hidden rounded-md border border-border bg-card">
        <div className="grid grid-cols-1 divide-y divide-border md:grid-cols-3 md:divide-x md:divide-y-0">
          {[0, 1, 2].map((column) => (
            <AnswerColumnSkeleton key={column} lines={column === 1 ? 4 : 5} />
          ))}
        </div>
      </div>
    </div>
  );
}

function AnswerColumnSkeleton({ lines }: { readonly lines: number }) {
  return (
    <div className="flex min-w-0 flex-col">
      <div className="flex items-center gap-2 px-3 pt-3">
        <SkeletonLine className="size-5 shrink-0 rounded-full" />
        <SkeletonLine className="h-3 w-24 max-w-[60%]" />
      </div>

      <SkeletonProse lines={lines} className="min-h-32 flex-1 px-3 py-3" />

      {/* The same rule the real column shows while a model is still typing —
          the receipt only prints once there are numbers to print. */}
      <div className="border-t border-dashed border-border" />
    </div>
  );
}

/** The composer, at its real size, with nothing typed into it. */
export function ComposerSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="flex flex-col gap-2 rounded-md border border-border bg-card p-2"
    >
      <div className="flex flex-col gap-2 px-3 py-2">
        <SkeletonLine className="w-1/2" />
      </div>
      <div className="flex items-end justify-between gap-2">
        <SkeletonLine className="h-8 w-36 rounded-md" />
        <SkeletonLine className="size-9 shrink-0 rounded-md" />
      </div>
    </div>
  );
}
