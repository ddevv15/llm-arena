"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SignInButton, UserButton } from "@clerk/nextjs";
import {
  Boxes,
  Check,
  Link2,
  PanelLeft,
  Plus,
  Swords,
  Trophy,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import type { ThreadSummary, ViewerRole } from "@/lib/thread-view";

export type ModelRecord = {
  name: string;
  wins: number;
  answered: number;
};

type AppShellProps = {
  threadName: string;
  modelRecords: ModelRecord[];
  threads: ThreadSummary[];
  /** `null` while a brand-new thread hasn't been created yet. */
  activeThreadId: string | null;
  viewer: ViewerRole;
  children: ReactNode;
};

export function AppShell({
  threadName,
  modelRecords,
  threads,
  activeThreadId,
  viewer,
  children,
}: AppShellProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // A signed-out reader following a shared link has no history of their own,
  // so there is no navigation to give them — an empty sidebar would just be a
  // column of nothing. A signed-in visitor reading someone else's thread does
  // still have their own list, and it stays exactly where they expect it.
  const showSidebar = viewer !== "anonymous";

  // Collapse lasts for the visit, not across visits. Restoring it from storage
  // needs the state read before first paint to avoid the sidebar animating
  // shut in front of the person, and that's a pre-hydration inline script —
  // more machinery than a nice-to-have toggle earns.
  const toggleCollapsed = () => setCollapsed((current) => !current);

  const closeNav = () => {
    setMobileNavOpen(false);
    menuButtonRef.current?.focus();
  };

  useEffect(() => {
    if (!mobileNavOpen) {
      return;
    }

    closeButtonRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeNav();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [mobileNavOpen]);

  return (
    <div className="flex h-dvh flex-col md:flex-row">
      {showSidebar ? (
        <Sidebar
          threads={threads}
          activeThreadId={activeThreadId}
          viewer={viewer}
          className={cn(
            "hidden transition-[width] duration-200 md:flex",
            collapsed ? "md:w-0 md:overflow-hidden md:border-r-0" : "md:w-64",
          )}
        />
      ) : null}

      {showSidebar && mobileNavOpen ? (
        <div className="fixed inset-0 z-40 flex md:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            className="absolute inset-0 bg-foreground/40"
            onClick={closeNav}
          />
          <Sidebar
            threads={threads}
            activeThreadId={activeThreadId}
            viewer={viewer}
            className="relative z-50 flex w-64"
            onNavigate={closeNav}
            header={
              <Button
                ref={closeButtonRef}
                variant="ghost"
                size="icon"
                aria-label="Close navigation"
                onClick={closeNav}
              >
                <X className="size-4" />
              </Button>
            }
          />
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          threadName={threadName}
          modelRecords={modelRecords}
          menuButtonRef={menuButtonRef}
          viewer={viewer}
          activeThreadId={activeThreadId}
          showNavToggle={showSidebar}
          sidebarCollapsed={collapsed}
          onOpenNav={() => setMobileNavOpen(true)}
          onToggleCollapsed={toggleCollapsed}
        />
        <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}

type NavItem = {
  label: string;
  href: string;
  icon: typeof Swords;
  /** Nav entries whose screen doesn't exist yet render inert, not broken. */
  pending?: boolean;
};

const NAV_ITEMS: readonly NavItem[] = [
  { label: "Arena", href: "/", icon: Swords },
  { label: "Leaderboard", href: "/leaderboard", icon: Trophy, pending: true },
  { label: "Models", href: "/models", icon: Boxes },
];

type SidebarProps = {
  threads: ThreadSummary[];
  activeThreadId: string | null;
  viewer: ViewerRole;
  className?: string;
  header?: ReactNode;
  /** Only the mobile drawer passes this — it closes itself on navigation. */
  onNavigate?: () => void;
};

function Sidebar({
  threads,
  activeThreadId,
  viewer,
  className,
  header,
  onNavigate,
}: SidebarProps) {
  const pathname = usePathname();

  return (
    <div
      className={cn(
        "shrink-0 flex-col border-r border-border bg-card",
        className,
      )}
    >
      <div className="flex w-64 min-w-64 flex-1 flex-col overflow-hidden">
        <div className="flex items-center justify-between gap-2 px-4 py-4">
          <Link href="/" className="font-display text-xl font-medium">
            LLM Arena
          </Link>
          {header}
        </div>

        <nav aria-label="Sections" className="flex flex-col gap-0.5 px-2">
          {NAV_ITEMS.map((item) => {
            const isActive = !item.pending && pathname === item.href;
            const content = (
              <>
                <item.icon className="size-4 shrink-0" aria-hidden="true" />
                <span className="flex-1 truncate">{item.label}</span>
                {item.pending ? (
                  <span className="shrink-0 font-mono text-[10px] tracking-wide text-muted-foreground uppercase">
                    Soon
                  </span>
                ) : null}
              </>
            );

            // An entry with nowhere to go is text, not a link a person can
            // click into a 404 — feature #9 turns this one into a real link.
            return item.pending ? (
              <span
                key={item.label}
                aria-disabled="true"
                className="flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm text-muted-foreground"
              >
                {content}
              </span>
            ) : (
              <Link
                key={item.label}
                href={item.href}
                onClick={onNavigate}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent",
                  isActive && "bg-accent font-medium text-accent-foreground",
                )}
              >
                {content}
              </Link>
            );
          })}
        </nav>

        <hr className="mx-4 my-3 border-border" />

        <div className="flex min-h-0 flex-1 flex-col gap-1 px-2">
          <span className="px-2 font-mono text-xs tracking-wide text-muted-foreground uppercase">
            Your threads
          </span>
          <Link
            href="/"
            onClick={onNavigate}
            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-primary transition-colors hover:bg-accent"
          >
            <Plus className="size-4 shrink-0" aria-hidden="true" />
            New thread
          </Link>

          <nav
            aria-label="Thread history"
            className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto pt-1"
          >
            {threads.length === 0 ? (
              <p className="px-2 py-2 text-sm text-muted-foreground">
                Threads you start show up here.
              </p>
            ) : (
              threads.map((thread) => {
                const isActive = thread.id === activeThreadId;
                return (
                  <Link
                    key={thread.id}
                    href={`/thread/${thread.id}`}
                    onClick={onNavigate}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "flex flex-col gap-0.5 rounded-md border-l-2 border-transparent px-2 py-1.5 text-sm transition-colors hover:bg-accent",
                      isActive &&
                        "border-primary bg-accent font-medium text-accent-foreground",
                    )}
                  >
                    <span className="truncate">{thread.title}</span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {thread.lastActive}
                    </span>
                  </Link>
                );
              })
            )}
          </nav>
        </div>

        {/* The account and the theme live down here, out of the way of the
            work, exactly where the wireframe puts them. */}
        <div className="flex items-center gap-2 border-t border-border px-4 py-3">
          {viewer === "anonymous" ? null : <UserButton />}
          <span className="flex-1" />
          <ThemeToggle />
        </div>
      </div>
    </div>
  );
}

type TopBarProps = {
  threadName: string;
  modelRecords: ModelRecord[];
  menuButtonRef: React.RefObject<HTMLButtonElement | null>;
  viewer: ViewerRole;
  activeThreadId: string | null;
  showNavToggle: boolean;
  sidebarCollapsed: boolean;
  onOpenNav: () => void;
  onToggleCollapsed: () => void;
};

function TopBar({
  threadName,
  modelRecords,
  menuButtonRef,
  viewer,
  activeThreadId,
  showNavToggle,
  sidebarCollapsed,
  onOpenNav,
  onToggleCollapsed,
}: TopBarProps) {
  const pathname = usePathname();

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border bg-card px-3 md:px-4">
      {showNavToggle ? (
        <>
          <Button
            ref={menuButtonRef}
            variant="ghost"
            size="icon"
            className="size-8 md:hidden"
            aria-label="Open navigation"
            onClick={onOpenNav}
          >
            <PanelLeft className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="hidden size-8 md:inline-flex"
            aria-label={sidebarCollapsed ? "Show sidebar" : "Hide sidebar"}
            aria-pressed={!sidebarCollapsed}
            onClick={onToggleCollapsed}
          >
            <PanelLeft className="size-4" />
          </Button>
        </>
      ) : (
        // With no sidebar there is no wordmark on the page at all, and no way
        // back out of a shared thread. This is both.
        <Link href="/" className="shrink-0 font-display text-lg font-medium">
          LLM Arena
        </Link>
      )}

      <Breadcrumb threadName={threadName} />

      <ul
        className={cn(
          "shrink-0 items-center gap-1.5",
          modelRecords.length === 0 ? "hidden" : "flex",
        )}
        aria-label="Win record in this thread"
      >
        {modelRecords.map((model) => (
          <WinChip key={model.name} model={model} />
        ))}
      </ul>

      {viewer === "owner" && activeThreadId ? <CopyLinkButton /> : null}

      {viewer === "anonymous" ? (
        <>
          <ThemeToggle />
          {/* Back to the thread they were reading, not to a generic home page —
              signing in to keep reading shouldn't cost someone their place. */}
          <SignInButton forceRedirectUrl={pathname}>
            <Button size="sm">Sign in</Button>
          </SignInButton>
        </>
      ) : null}
    </header>
  );
}

/** `Arena / <thread>` — where you are, and the one step back out of it. */
function Breadcrumb({ threadName }: { threadName: string }) {
  return (
    <nav aria-label="Breadcrumb" className="min-w-0 flex-1">
      <ol className="flex min-w-0 items-center gap-1.5 text-sm">
        {/* The trail hides on a phone. The hamburger beside it already leads
            back out, and on a 390px bar "Arena /" costs the thread's own name
            the room it needs to stay readable. */}
        <li className="hidden shrink-0 sm:block">
          <Link
            href="/"
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            Arena
          </Link>
        </li>
        <li
          aria-hidden="true"
          className="hidden shrink-0 text-muted-foreground/60 sm:block"
        >
          /
        </li>
        <li className="min-w-0">
          <h1 className="truncate font-display text-base font-medium">
            {threadName}
          </h1>
        </li>
      </ol>
    </nav>
  );
}

/**
 * One model's record in this thread: its initial, and wins over turns it
 * actually answered.
 *
 * A ratio rather than a tally, because "1" alone never says out of how many.
 * The circle stays plain — giving each model a distinct icon is explicitly on
 * scope.md's not-doing list — so the full name rides along as the accessible
 * name and the tooltip, which is also what disambiguates two models whose
 * names happen to start with the same letter.
 */
function WinChip({ model }: { model: ModelRecord }) {
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
        {model.name}: won {model.wins} of {model.answered}
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
