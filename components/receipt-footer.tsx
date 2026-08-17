import { cn } from "@/lib/utils";

type ReceiptRow = {
  label: string;
  value: string;
};

type ReceiptFooterProps = {
  rows: ReceiptRow[];
  className?: string;
};

/**
 * The app's signature element: every model answer ends in a printed-ticket
 * strip of its real numbers (tokens/s, ttft, cost — including an honest
 * $0.0000), not a stat card. See scope.md feature #4.
 */
export function ReceiptFooter({ rows, className }: ReceiptFooterProps) {
  return (
    <dl
      className={cn(
        "border-t border-dashed border-border pt-2 font-mono text-xs text-muted-foreground",
        className,
      )}
    >
      {rows.map((row) => (
        <div key={row.label} className="flex items-baseline gap-2 py-0.5">
          <dt className="shrink-0 uppercase tracking-wide">{row.label}</dt>
          <span
            aria-hidden="true"
            className="-translate-y-0.5 flex-1 border-b border-dotted border-muted-foreground/40"
          />
          <dd className="shrink-0 text-foreground">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}
