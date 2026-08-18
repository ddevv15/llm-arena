"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { Menu, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export type ThreadSummary = {
  id: string;
  title: string;
  lastActive: string;
};

export type ModelRecord = {
  name: string;
  wins: number;
};

type AppShellProps = {
  threadName: string;
  modelRecords: ModelRecord[];
  threads: ThreadSummary[];
  activeThreadId: string;
  children: ReactNode;
};

export function AppShell({
  threadName,
  modelRecords,
  threads,
  activeThreadId,
  children,
}: AppShellProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

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
    <div className="flex h-dvh flex-col">
      <TopBar
        threadName={threadName}
        modelRecords={modelRecords}
        menuButtonRef={menuButtonRef}
        onOpenNav={() => setMobileNavOpen(true)}
      />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          threads={threads}
          activeThreadId={activeThreadId}
          className="hidden md:flex"
        />
        {mobileNavOpen ? (
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
              className="relative z-50 flex w-72 shadow-lg"
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
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}

type SidebarProps = {
  threads: ThreadSummary[];
  activeThreadId: string;
  className?: string;
  header?: ReactNode;
};

function Sidebar({ threads, activeThreadId, className, header }: SidebarProps) {
  return (
    <nav
      aria-label="Thread history"
      className={cn(
        "w-72 shrink-0 flex-col gap-4 border-r border-border bg-card p-4",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <Link href="/" className="font-display text-xl font-medium">
          LLM Arena
        </Link>
        {header}
      </div>
      <Button className="justify-start gap-2">
        <Plus className="size-4" />
        New thread
      </Button>
      <div className="flex flex-col gap-1 overflow-y-auto">
        <span className="px-2 pb-1 font-mono text-xs tracking-wide text-muted-foreground uppercase">
          Threads
        </span>
        {threads.map((thread) => {
          const isActive = thread.id === activeThreadId;
          return (
            <Link
              key={thread.id}
              href={`/thread/${thread.id}`}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex flex-col gap-0.5 rounded-md border-l-2 border-transparent px-2 py-2 text-sm transition-colors hover:bg-accent",
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
        })}
      </div>
    </nav>
  );
}

type TopBarProps = {
  threadName: string;
  modelRecords: ModelRecord[];
  menuButtonRef: React.RefObject<HTMLButtonElement | null>;
  onOpenNav: () => void;
};

function TopBar({
  threadName,
  modelRecords,
  menuButtonRef,
  onOpenNav,
}: TopBarProps) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-card px-4">
      <Button
        ref={menuButtonRef}
        variant="ghost"
        size="icon"
        className="md:hidden"
        aria-label="Open navigation"
        onClick={onOpenNav}
      >
        <Menu className="size-4" />
      </Button>
      <h1 className="min-w-0 flex-1 truncate font-display text-base font-medium md:text-lg">
        {threadName}
      </h1>
      <ul className="hidden items-center gap-2 sm:flex" aria-label="Win record">
        {modelRecords.map((model) => (
          <li
            key={model.name}
            className="flex items-center gap-1.5 rounded-sm border border-border bg-secondary px-2 py-1 font-mono text-xs text-secondary-foreground"
          >
            <span className="max-w-24 truncate">{model.name}</span>
            <span className="text-muted-foreground">·</span>
            <span>{model.wins}</span>
          </li>
        ))}
      </ul>
      <ul className="flex items-center gap-1 sm:hidden" aria-label="Win record">
        {modelRecords.map((model) => (
          <li
            key={model.name}
            title={model.name}
            className="flex items-center gap-1 rounded-full border border-border bg-secondary px-1.5 py-0.5 font-mono text-xs text-secondary-foreground"
          >
            <span aria-hidden="true">●</span>
            <span>{model.wins}</span>
          </li>
        ))}
      </ul>
      <UserButton />
    </header>
  );
}
