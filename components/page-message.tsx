import type { ReactNode } from "react";

/**
 * A whole page that is only a sentence: the 404, and the screens shown when
 * Arcjet turns a reader away.
 *
 * It exists because those screens are the same object — a status code, a plain
 * heading, one paragraph, one way out — and the second one was about to be a
 * copy of `app/not-found.tsx`'s markup with different words in it. There is no
 * new visual direction here on purpose; the shape was already decided.
 *
 * The eyebrow is a real HTTP status, not a label. It stays because a code is
 * the one thing a reader can quote when something goes wrong, and it's the
 * difference between "gone" and "you're going too fast" at a glance.
 */
type PageMessageProps = {
  readonly code: string;
  readonly title: string;
  readonly children: ReactNode;
  /** The single way out. Optional, since not every dead end has one. */
  readonly action?: ReactNode;
};

export function PageMessage({
  code,
  title,
  children,
  action,
}: PageMessageProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
      <p className="font-mono text-xs tracking-wide text-muted-foreground uppercase">
        {code}
      </p>
      <h1 className="font-display text-2xl font-medium">{title}</h1>
      <p className="max-w-prose text-muted-foreground">{children}</p>
      {action}
    </div>
  );
}
