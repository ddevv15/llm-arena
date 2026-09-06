"use client";

import { useEffect, useRef, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SignInButton, UserButton } from "@clerk/nextjs";
import { Boxes, Plus, Swords, Trophy, X } from "lucide-react";
import { useSidebar } from "@/components/sidebar-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ThreadSummary } from "@/lib/thread-view";

/**
 * The app's navigation, rendered by the arena layout rather than by a page.
 *
 * That placement is the point. A `loading.tsx` boundary replaces everything
 * its page renders, so while the sidebar lived inside the page, every thread
 * click blanked it and redrew all fifty links. Next keeps a layout mounted
 * across a client navigation, so from here it simply stays put and only the
 * column beside it changes.
 *
 * It renders for everyone. Feature #12 removed the sign-in gate around it: a
 * signed-out visitor has no thread history, but they do have three places to
 * go, and hiding the whole column to avoid showing an empty list left them
 * with no navigation anywhere in the app.
 */

type NavItem = {
  readonly label: string;
  readonly href: string;
  readonly icon: typeof Swords;
};

const NAV_ITEMS: readonly NavItem[] = [
  { label: "Arena", href: "/", icon: Swords },
  { label: "Leaderboard", href: "/leaderboard", icon: Trophy },
  { label: "Models", href: "/models", icon: Boxes },
];

export function AppSidebar() {
  const { collapsed, mobileNavOpen, closeNav } = useSidebar();
  const closeButtonRef = useRef<HTMLButtonElement>(null);

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
  }, [mobileNavOpen, closeNav]);

  return (
    <>
      <SidebarPanel
        className={cn(
          "hidden transition-[width] duration-200 md:flex",
          collapsed ? "md:w-0 md:overflow-hidden md:border-r-0" : "md:w-64",
        )}
      />

      {mobileNavOpen ? (
        <div className="fixed inset-0 z-40 flex md:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            className="absolute inset-0 bg-foreground/40"
            onClick={closeNav}
          />
          <SidebarPanel
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
    </>
  );
}

type SidebarPanelProps = {
  readonly className?: string;
  readonly header?: ReactNode;
  /** Only the mobile drawer passes this — it closes itself on navigation. */
  readonly onNavigate?: () => void;
};

function SidebarPanel({ className, header, onNavigate }: SidebarPanelProps) {
  const { threads, activeThreadId, signedIn } = useSidebar();
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
            const isActive = pathname === item.href;

            return (
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
                <item.icon className="size-4 shrink-0" aria-hidden="true" />
                <span className="flex-1 truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <hr className="mx-4 my-3 border-border" />

        {signedIn ? (
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
                threads.map((thread) => (
                  <ThreadLink
                    key={thread.id}
                    thread={thread}
                    isActive={thread.id === activeThreadId}
                    onNavigate={onNavigate}
                  />
                ))
              )}
            </nav>
          </div>
        ) : (
          <SignInInvitation />
        )}

        {/* The account and the theme live down here, out of the way of the
            work, exactly where the wireframe puts them. */}
        <div className="flex items-center gap-2 border-t border-border px-4 py-3">
          {signedIn ? <UserButton /> : null}
          <span className="flex-1" />
          <ThemeToggle />
        </div>
      </div>
    </div>
  );
}

/**
 * What sits where the thread list would be, for someone without an account.
 *
 * The sidebar used to be hidden outright when signed out, on the reasoning
 * that "an empty sidebar would just be a column of nothing". That conflated
 * two different things: having no thread history, and having no navigation.
 * The section nav above is not nothing, and hiding it left a signed-out
 * visitor with no way to reach the leaderboard or the models list from
 * anywhere in the app.
 *
 * So the list is what's replaced, not the sidebar — and what replaces it says
 * what an account is actually for here, rather than just asking for one.
 */
function SignInInvitation() {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-start gap-3 px-4 py-2">
      <p className="text-sm text-muted-foreground">
        Threads you start are saved here once you have an account. Reading and
        comparing needs nothing.
      </p>
      <SignInButton>
        <Button size="sm">Sign in</Button>
      </SignInButton>
    </div>
  );
}

function ThreadLink({
  thread,
  isActive,
  onNavigate,
}: {
  readonly thread: ThreadSummary;
  readonly isActive: boolean;
  readonly onNavigate?: () => void;
}) {
  return (
    <Link
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
}
