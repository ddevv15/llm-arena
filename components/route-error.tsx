"use client";

import { useEffect, type ReactNode } from "react";
import { PageMessage } from "@/components/page-message";
import { Button } from "@/components/ui/button";

/**
 * What a route shows when rendering it threw.
 *
 * Three routes need this and the object is the same one every time — a code
 * you can quote, a plain sentence about what actually failed, and a way to try
 * again — so it lives here rather than being pasted three times with different
 * words. It's `PageMessage`, the same component behind the 404 and Arcjet's
 * denial screens, because this is the same shape of dead end.
 *
 * Two rules from `AGENTS.md` are load-bearing here. The caught exception is
 * never rendered: a provider's error text or a stack trace is not something a
 * person can act on and may say more than it should. And there is always a
 * retry, because `reset()` genuinely re-renders the segment and a transient
 * failure really does clear.
 *
 * The eyebrow is Next's `digest` when there is one. That keeps
 * `PageMessage`'s rule honest — it's a real identifier that appears in the
 * server log next to the actual stack, so a person quoting it is handing over
 * something that can be looked up, not a label.
 */
type RouteErrorProps = {
  readonly error: Error & { readonly digest?: string };
  readonly reset: () => void;
  readonly title: string;
  /** What failed, in plain words. No apology, no exception text. */
  readonly children: ReactNode;
  /** An escape hatch beyond retrying, where the route has one. */
  readonly action?: ReactNode;
};

export function RouteError({
  error,
  reset,
  title,
  children,
  action,
}: RouteErrorProps) {
  useEffect(() => {
    // The digest, not the message: this is only here to tie what the reader
    // saw to the server log that holds the real stack.
    console.error("Route render failed", { digest: error.digest });
  }, [error.digest]);

  return (
    <PageMessage
      code={error.digest ?? "Error"}
      title={title}
      action={
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button onClick={reset}>Try again</Button>
          {action}
        </div>
      }
    >
      {children}
    </PageMessage>
  );
}
