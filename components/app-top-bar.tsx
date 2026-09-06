"use client";

import { useEffect, useState } from "react";
import { Check, Link2 } from "lucide-react";
import {
  BackToArena,
  SidebarToggles,
  SignInAction,
} from "@/components/bar-controls";
import { useSidebar } from "@/components/sidebar-provider";
import { Button } from "@/components/ui/button";
import { winRecordLabel } from "@/components/win-record";
import { cn } from "@/lib/utils";
import type { ViewerRole } from "@/lib/thread-view";

/**
 * The bar above the arena: where you are, how each model is doing in this
 * thread, and the way to share it.
 *
 * This stays with the page while the sidebar moved up into the layout, and the
 * split is deliberate rather than half-finished. The win chips are derived from
 * the arena's live `turns` — client state the page owns — so hoisting the bar
 * too would mean bridging that state upward for the sake of a 56px strip.
 * Feature #11 records that as a considered trade, revisitable in Phase 2.
 *
 * What it does read from the layout is the sidebar's own state, since the two
 * buttons that open and collapse the sidebar live here.
 */

export type ModelRecord = {
  readonly name: string;
  readonly wins: number;
  readonly answered: number;
};

type AppTopBarProps = {
  readonly threadName: string;
  readonly modelRecords: readonly ModelRecord[];
  readonly viewer: ViewerRole;
};

export function AppTopBar({
  threadName,
  modelRecords,
  viewer,
}: AppTopBarProps) {
  const { activeThreadId } = useSidebar();

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border bg-card px-3 md:px-4">
      <SidebarToggles />

      {/* No back control on the new-thread page — it *is* the arena, and a
          button pointing at the page you're already on is noise. */}
      {activeThreadId ? <BackToArena /> : null}

      <h1 className="min-w-0 flex-1 truncate font-display text-base font-medium">
        {threadName}
      </h1>

      {/* Hidden on a phone, and that is the fix rather than a compromise.
          These three chips are what used to push the thread's own name and the
          only way out off a 390px bar; "N 1/3" is not worth either of those.
          They come back the moment there is room for them. */}
      <ul
        className={cn(
          "shrink-0 items-center gap-1.5",
          modelRecords.length === 0 ? "hidden" : "hidden sm:flex",
        )}
        aria-label="Win record in this thread"
      >
        {modelRecords.map((model) => (
          <WinChip key={model.name} model={model} />
        ))}
      </ul>

      {viewer === "owner" && activeThreadId ? <CopyLinkButton /> : null}

      {/* No theme toggle beside this any more. It used to be here because a
          signed-out reader had no sidebar to put it in; now everyone has one,
          and two toggles on the same screen is one too many. */}
      {viewer === "anonymous" ? <SignInAction /> : null}
    </header>
  );
}

/**
 * One model's record in this thread: its initial, and wins over turns it
 * actually answered.
 *
 * A ratio rather than a bare tally, because "1" alone never says out of how
 * many. The circle stays plain — giving each model a distinct icon is
 * explicitly on scope.md's not-doing list — so the full name rides along as the
 * accessible name and the tooltip, which is also what disambiguates two models
 * whose names happen to start with the same letter.
 */
function WinChip({ model }: { readonly model: ModelRecord }) {
  const initial = model.name.trim().charAt(0).toUpperCase();

  return (
    <li
      title={model.name}
      className="flex items-center gap-1.5 rounded-full border border-border py-0.5 pr-2 pl-0.5"
    >
      <span
        aria-hidden="true"
        className="grid size-5 place-items-center rounded-full bg-secondary font-mono text-[10px] text-secondary-foreground"
      >
        {initial}
      </span>
      <span aria-hidden="true" className="font-mono text-xs">
        {model.wins}/{model.answered}
      </span>
      <span className="sr-only">
        {winRecordLabel(model.name, model.wins, model.answered)}
      </span>
    </li>
  );
}

/** How long the button keeps saying "Copied" before going back to normal. */
const COPY_FEEDBACK_MS = 2000;

type CopyState = "idle" | "copied" | "failed";

/**
 * The share affordance, owner-only — a reader already has the link.
 *
 * `navigator.clipboard` genuinely fails sometimes (an insecure origin, a
 * browser that refuses the permission), so the failure is a state the button
 * can show rather than a rejected promise nobody sees. The button is its own
 * retry, and the address bar still works.
 */
function CopyLinkButton() {
  const [state, setState] = useState<CopyState>("idle");

  useEffect(() => {
    if (state === "idle") {
      return;
    }
    const timer = setTimeout(() => setState("idle"), COPY_FEEDBACK_MS);
    return () => clearTimeout(timer);
  }, [state]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setState("copied");
    } catch {
      setState("failed");
    }
  };

  const label =
    state === "copied"
      ? "Copied"
      : state === "failed"
        ? "Couldn't copy"
        : "Copy link";

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="shrink-0 gap-1.5"
        // A fixed accessible name. The visible label changes to report what
        // happened, but a button whose *name* keeps changing is a button a
        // screen reader user can't learn.
        aria-label="Copy link to this thread"
        onClick={() => void copy()}
      >
        {state === "copied" ? (
          <Check className="size-4" />
        ) : (
          <Link2 className="size-4" />
        )}
        <span className="hidden sm:inline" aria-hidden="true">
          {label}
        </span>
      </Button>
      {/* The outcome, announced once, from outside the button — so it isn't
          folded into the name and re-read on every focus. */}
      <span role="status" aria-live="polite" className="sr-only">
        {state === "failed"
          ? "Couldn't copy the link. Try again."
          : state === "copied"
            ? "Link copied"
            : ""}
      </span>
    </>
  );
}
