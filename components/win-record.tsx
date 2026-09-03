import { cn } from "@/lib/utils";

/**
 * How a win record is said, everywhere it's said.
 *
 * The sidebar chips and the leaderboard show the same fact at very different
 * sizes, and the wording had already been written twice. It lives here so the
 * two can't drift into "won 4 of 5" in one place and "4 wins / 5" in the other.
 */
export const winRecordLabel = (
  name: string,
  wins: number,
  of: number,
): string => `${name}: won ${wins} of ${of}`;

/**
 * The win rate, set as a sentence rather than a statistic.
 *
 * scope.md #9 asks for two things that pull against each other: the rate as the
 * big bold number in the accent, and never a bare percentage or invented score.
 * A big "80%" would break the second; a plain sentence would break the first.
 * So the numerals carry the weight and the words stay small around them — the
 * phrase reads as English and still lands as the loudest thing in the row.
 */
export function WinExpression({
  wins,
  of,
  className,
}: {
  readonly wins: number;
  readonly of: number;
  readonly className?: string;
}) {
  return (
    <p
      className={cn("flex items-baseline gap-1.5 whitespace-nowrap", className)}
    >
      <span className="text-sm text-muted-foreground">won</span>
      <span className="font-mono text-2xl leading-none font-medium text-primary">
        {wins}
      </span>
      <span className="text-sm text-muted-foreground">of</span>
      <span className="font-mono text-2xl leading-none font-medium text-primary">
        {of}
      </span>
    </p>
  );
}

/**
 * The rate as a length. Decorative only in the sense that the number is always
 * printed next to it — so it's hidden from screen readers rather than
 * duplicating what `WinExpression` already says.
 */
export function WinRateBar({
  wins,
  of,
}: {
  readonly wins: number;
  readonly of: number;
}) {
  const pct = of === 0 ? 0 : Math.round((wins / of) * 100);

  return (
    <div
      aria-hidden="true"
      className="h-1 w-full overflow-hidden rounded-xs bg-secondary"
    >
      <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
    </div>
  );
}
