import { PageBar } from "@/components/page-bar";
import { SkeletonLine } from "@/components/skeleton";

/**
 * The models list, arriving.
 *
 * It has one of its own rather than inheriting the arena's, which would draw a
 * composer and three answer columns for a page that is a table.
 *
 * The table's own structure is certain — the same three columns every time —
 * so the header row is real and only the rows are bars. Eight of them, near
 * the size of the free-tier catalog.
 */
export default function Loading() {
  return (
    <>
      <PageBar title="Models" />
      <main className="min-h-0 flex-1 overflow-y-auto">
        <div
          role="status"
          className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-12"
        >
          <span className="sr-only">Loading the models list</span>
          <p className="max-w-prose text-muted-foreground">
            Every free-tier model the arena can call, sorted by context window.
            Cost is always $0.0000, that&apos;s real, not a bug.
          </p>

          <div className="overflow-hidden rounded-md border border-border">
            <div className="grid grid-cols-[1fr_auto_auto] gap-x-6 border-b border-border bg-card px-4 py-2 text-sm text-muted-foreground">
              <span>Model</span>
              <span>Context</span>
              <span>Price</span>
            </div>
            {Array.from({ length: 8 }, (_, row) => (
              <div
                key={row}
                aria-hidden="true"
                className="grid grid-cols-[1fr_auto_auto] items-center gap-x-6 border-b border-border px-4 py-3 last:border-0"
              >
                <SkeletonLine className="w-56 max-w-full" />
                <SkeletonLine className="w-20" />
                <SkeletonLine className="w-14" />
              </div>
            ))}
          </div>
        </div>
      </main>
    </>
  );
}
