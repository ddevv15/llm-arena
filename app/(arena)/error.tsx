"use client";

import { RouteError } from "@/components/route-error";

export default function ArenaError({
  error,
  reset,
}: {
  readonly error: Error & { readonly digest?: string };
  readonly reset: () => void;
}) {
  return (
    <RouteError error={error} reset={reset} title="The arena didn't load">
      Something failed while building this page. No prompt was sent, so nothing
      you typed has gone anywhere.
    </RouteError>
  );
}
