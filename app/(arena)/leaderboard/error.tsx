"use client";

import Link from "next/link";
import { RouteError } from "@/components/route-error";
import { Button } from "@/components/ui/button";

export default function LeaderboardError({
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
      title="The leaderboard didn't load"
      action={
        <Button variant="outline" asChild>
          <Link href="/">Go to the arena</Link>
        </Button>
      }
    >
      Every vote is still counted. Reading the totals back is what failed.
    </RouteError>
  );
}
