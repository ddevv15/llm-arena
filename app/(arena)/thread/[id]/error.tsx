"use client";

import Link from "next/link";
import { RouteError } from "@/components/route-error";
import { Button } from "@/components/ui/button";

export default function ThreadError({
  error,
  reset,
}: {
  readonly error: Error & { readonly digest?: string };
  readonly reset: () => void;
}) {
  return (
    <RouteError
      error={error}
      reset={reset}
      title="This thread didn't load"
      action={
        <Button variant="outline" asChild>
          <Link href="/">Start a new thread</Link>
        </Button>
      }
    >
      {/* Worth saying outright. A thread page that fails looks exactly like a
          thread that's gone, and the difference matters to someone who just
          shared the link. */}
      The thread and everything in it are still there. Reading it back is what
      failed.
    </RouteError>
  );
}
