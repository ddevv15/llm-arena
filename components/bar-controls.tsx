"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SignInButton } from "@clerk/nextjs";
import { ChevronLeft, PanelLeft } from "lucide-react";
import { useSidebar } from "@/components/sidebar-provider";
import { Button } from "@/components/ui/button";

/**
 * The controls every bar in the app shares: open the sidebar, go back, sign
 * in.
 *
 * Both bars need all of them — the arena's top bar and the plain page bar on
 * the leaderboard and models pages — so they live here rather than being
 * written twice.
 */

/**
 * Opens the drawer on a phone, collapses the column on a desktop. Two buttons
 * rather than one because they do genuinely different things at the two sizes.
 */
export function SidebarToggles() {
  const { collapsed, toggleCollapsed, openNav, menuButtonRef } = useSidebar();

  return (
    <>
      <Button
        ref={menuButtonRef}
        variant="ghost"
        size="icon"
        className="size-8 md:hidden"
        aria-label="Open navigation"
        onClick={openNav}
      >
        <PanelLeft className="size-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="hidden size-8 md:inline-flex"
        aria-label={collapsed ? "Show sidebar" : "Hide sidebar"}
        aria-pressed={!collapsed}
        onClick={toggleCollapsed}
      >
        <PanelLeft className="size-4" />
      </Button>
    </>
  );
}

/**
 * The way back out of a page, on every page that isn't the arena itself.
 *
 * It goes to `/` rather than calling `history.back()`, and that is the whole
 * point rather than a shortcut. A thread link is meant to be shared, so the
 * commonest way to arrive on one of these pages is cold, in a fresh tab, with
 * nothing behind it — `history.back()` there does nothing at all, which is a
 * worse failure than no button, because it looks broken rather than absent.
 * Going somewhere structural always works and always lands in the same place.
 *
 * The label appears from `sm` up and the arrow carries it alone below that,
 * where every pixel of the bar is contested by the thread's own name.
 */
export function BackToArena() {
  return (
    <Button
      variant="ghost"
      size="sm"
      className="shrink-0 gap-1 px-1.5 sm:px-2"
      aria-label="Back to the arena"
      asChild
    >
      <Link href="/">
        <ChevronLeft className="size-4" aria-hidden="true" />
        <span className="hidden sm:inline" aria-hidden="true">
          Arena
        </span>
      </Link>
    </Button>
  );
}

/**
 * The sign-in button in a page's bar, for someone who hasn't got an account
 * yet.
 *
 * The sidebar carries a fuller invitation, but the sidebar is a drawer below
 * `md` — so without this a signed-out visitor on a phone would have no visible
 * way to sign in at all.
 *
 * It returns them to the page they were on rather than to a generic home page:
 * signing in shouldn't cost someone their place.
 */
export function SignInAction() {
  const pathname = usePathname();

  return (
    <SignInButton forceRedirectUrl={pathname}>
      <Button size="sm" className="shrink-0">
        Sign in
      </Button>
    </SignInButton>
  );
}
