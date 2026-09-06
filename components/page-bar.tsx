"use client";

import {
  BackToArena,
  SidebarToggles,
  SignInAction,
} from "@/components/bar-controls";
import { useSidebar } from "@/components/sidebar-provider";

/**
 * The bar above a page that isn't a thread — the leaderboard and the models
 * list.
 *
 * Deliberately not `AppTopBar` with the thread parts switched off. That bar
 * exists to say which thread you're in and how each model is doing in it, and
 * a version of it with the breadcrumb reading "Arena / Leaderboard" would be
 * describing a hierarchy the app doesn't have. These are siblings of the
 * arena, not children of it.
 *
 * What the two bars genuinely share is the sidebar controls and the sign-in
 * button, and those live in `sidebar-toggles.tsx` rather than being written
 * twice.
 *
 * It carries the toggles at all because the sidebar is a drawer below `md` —
 * without a hamburger up here, a phone would have no way to open it.
 */
export function PageBar({ title }: { readonly title: string }) {
  const { signedIn } = useSidebar();

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border bg-card px-3 md:px-4">
      <SidebarToggles />
      <BackToArena />
      <h1 className="min-w-0 flex-1 truncate font-display text-base font-medium">
        {title}
      </h1>
      {signedIn ? null : <SignInAction />}
    </header>
  );
}
