import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";

// The title has to come from here, not from the thread page's own
// `generateMetadata`. Once `notFound()` is thrown Next renders this boundary
// and takes its metadata from it, discarding whatever the page had resolved.
export const metadata: Metadata = { title: "Not found" };

/**
 * The 404 for the whole app, and in practice mostly for shared thread links —
 * a mistyped id and a thread that's gone land here identically, which is all
 * a reader needs to know.
 *
 * It exists because `notFound()` was otherwise falling through to Next's stock
 * black-on-white page, which reads like a broken deploy rather than a missing
 * thread.
 */
export default function NotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
      <p className="font-mono text-xs tracking-wide text-muted-foreground uppercase">
        404
      </p>
      <h1 className="font-display text-2xl font-medium">
        That thread isn&apos;t here
      </h1>
      <p className="max-w-prose text-muted-foreground">
        The link may be mistyped, or the thread may be gone. Either way
        there&apos;s nothing to show.
      </p>
      <Button asChild>
        <Link href="/">Start a thread of your own</Link>
      </Button>
    </div>
  );
}
