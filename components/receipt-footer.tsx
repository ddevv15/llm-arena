"use client";

import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

type ReceiptRow = {
  label: string;
  value: string;
};

type ReceiptFooterProps = {
  /** The always-visible line. Put the number worth comparing at a glance here. */
  headline: ReceiptRow;
  /** Everything behind the toggle. */
  rows: ReceiptRow[];
  className?: string;
};

/**
 * The app's signature element: every model answer ends in a printed-ticket
 * strip of its real numbers (tokens/s, ttft, cost — including an honest
 * $0.0000), not a stat card. See scope.md feature #4.
 *
 * The headline row always prints, so three models' throughput lines up in a
 * column you can read across without opening anything; the rest folds away.
 * That's the reconciliation between #4, which makes this footer the signature,
 * and the wireframe, which wanted metrics behind a toggle — a fully hidden
 * receipt would have made the app's one honest promise invisible by default.
 */
export function ReceiptFooter({
  headline,
  rows,
  className,
}: ReceiptFooterProps) {
  const [open, setOpen] = useState(false);
  const detailId = useId();

  return (
    <div
      className={cn(
        "border-t border-dashed border-border font-mono text-xs",
        className,
      )}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={detailId}
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-baseline gap-2 px-3 py-2 text-left text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronDown
          aria-hidden="true"
          className={cn(
            "size-3 shrink-0 translate-y-0.5 transition-transform",
            open && "rotate-180",
          )}
        />
        <span className="shrink-0 tracking-wide uppercase">
          {headline.label}
        </span>
        <Leader />
        <span className="shrink-0 text-foreground">{headline.value}</span>
        <span className="sr-only">
          {open
            ? "Hide the rest of the receipt"
            : "Show the rest of the receipt"}
        </span>
      </button>

      <dl id={detailId} hidden={!open} className="px-3 pb-2 pl-8">
        {rows.map((row) => (
          <div key={row.label} className="flex items-baseline gap-2 py-0.5">
            <dt className="shrink-0 tracking-wide text-muted-foreground uppercase">
              {row.label}
            </dt>
            <Leader />
            <dd className="shrink-0">{row.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** The dotted leader between a label and its value — the ticket-stub motif. */
function Leader() {
  return (
    <span
      aria-hidden="true"
      className="-translate-y-0.5 flex-1 border-b border-dotted border-muted-foreground/40"
    />
  );
}
