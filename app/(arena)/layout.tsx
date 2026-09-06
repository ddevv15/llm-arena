import type { ReactNode } from "react";
import { auth } from "@clerk/nextjs/server";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarProvider } from "@/components/sidebar-provider";
import { listThreads } from "@/lib/threads";

/**
 * The frame around every page with navigation in it — the new-thread page, a
 * thread, the leaderboard and the models list.
 *
 * It exists for one reason, measured rather than assumed: Next keeps a layout
 * mounted across a client navigation, but a `loading.tsx` replaces everything
 * its *page* renders. While the sidebar lived inside the page, adding a loading
 * boundary would have blanked fifty thread links on every click and redrawn
 * them — trading a half-second of nothing for a flicker. From up here the
 * sidebar simply stays, and the skeleton only covers the column that changed.
 *
 * Feature #12 brought `/leaderboard` and `/models` in here too. They had been
 * standalone pages with no shell at all, for everyone — so clicking
 * "Leaderboard" in the sidebar landed you somewhere the sidebar didn't exist,
 * and reaching "Models" from there meant going back to `/` first. The cost is
 * recorded in scope.md: `/models` was the app's one prerendered route, and a
 * layout that reads `auth()` makes it dynamic.
 *
 * One consequence worth knowing before it surprises someone: because Next does
 * *not* re-render a shared layout on a client navigation, the thread list is
 * fetched once per full page load rather than once per click. A thread created
 * in this session still appears immediately — `SidebarProvider` takes it from
 * `/api/turns`' own response — but the "3 min ago" timestamps beneath the
 * others now hold still until the next reload. That is the trade the
 * persistence buys, and it is the right way round: a stale relative timestamp
 * costs nothing, a flickering sidebar costs attention on every click.
 */
export default async function ArenaLayout({
  children,
}: {
  readonly children: ReactNode;
}) {
  const { userId } = await auth();

  // A signed-out reader has no history to list, and asking for one would be a
  // query guaranteed to come back empty.
  const threads = userId ? await listThreads(userId) : [];

  return (
    <SidebarProvider initialThreads={threads} signedIn={Boolean(userId)}>
      <div className="flex h-dvh flex-col md:flex-row">
        <AppSidebar />
        <div className="flex min-w-0 flex-1 flex-col">{children}</div>
      </div>
    </SidebarProvider>
  );
}
