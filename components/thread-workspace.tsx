"use client";

import { useCallback, useMemo, useState } from "react";
import { AppShell, type ModelRecord } from "@/components/app-shell";
import { Arena } from "@/components/arena";
import { useArena } from "@/components/use-arena";
import type { CatalogModel } from "@/lib/model-catalog";
import type { FreeModelId } from "@/lib/models";
import {
  deriveWinRecords,
  selectDefaultModels,
  selectInitialModels,
  type ThreadDetail,
  type ThreadSummary,
  type ViewerRole,
} from "@/lib/thread-view";

const NEW_THREAD_TITLE = "New thread";

type ThreadWorkspaceProps = {
  catalog: CatalogModel[];
  threads: ThreadSummary[];
  /** `null` on the new-thread page — nothing has been asked yet. */
  thread: ThreadDetail | null;
  /**
   * Anything other than `"owner"` renders the thread read-only. This hides
   * controls; it does not enforce anything. `/api/turns`, `/api/chat` and the
   * vote route each re-check ownership themselves, which is where the actual
   * rule lives.
   */
  viewer: ViewerRole;
};

/**
 * The signed-in screen: the shell, its thread list, and the arena inside it.
 *
 * This is the one client component that spans both, because the two have to
 * agree. The top bar's win record is derived from the same turns the answer
 * panels render, and a thread created by the first prompt has to appear in
 * the sidebar without waiting for a round trip.
 *
 * Both pages that render this pass `key={thread?.id ?? "new"}`, so moving
 * between threads genuinely remounts it rather than leaving one thread's
 * state sitting under another thread's data.
 */
export function ThreadWorkspace({
  catalog,
  threads: serverThreads,
  thread,
  viewer,
}: ThreadWorkspaceProps) {
  const [threads, setThreads] = useState(serverThreads);
  const [activeThreadId, setActiveThreadId] = useState(thread?.id ?? null);
  const [threadTitle, setThreadTitle] = useState(
    thread?.title ?? NEW_THREAD_TITLE,
  );

  const [selectedIds, setSelectedIds] = useState<FreeModelId[]>(() => {
    const availableIds = catalog.map((model) => model.id);
    return selectInitialModels(
      thread?.turns ?? [],
      availableIds,
      selectDefaultModels(availableIds),
    );
  });

  const onThreadCreated = useCallback(
    ({ id, title }: { id: string; title: string }) => {
      // Swap the URL in place instead of navigating. `router.push` would
      // unmount this tree, and with it the three in-flight `fetch` readers
      // streaming the answers currently on screen. The History API changes
      // the address bar — so a reload or a shared link lands on the real
      // thread — while leaving the running streams completely alone.
      window.history.replaceState(null, "", `/thread/${id}`);
      setActiveThreadId(id);
      setThreadTitle(title);
      setThreads((current) => [
        { id, title, lastActive: "Just now" },
        ...current,
      ]);
    },
    [],
  );

  const arena = useArena({
    threadId: thread?.id ?? null,
    initialTurns: thread?.turns ?? [],
    onThreadCreated,
  });

  const modelRecords = useMemo<ModelRecord[]>(() => {
    const nameOf = (id: string) =>
      catalog.find((model) => model.id === id)?.name ?? id;

    return deriveWinRecords(arena.turns).map((record) => ({
      name: nameOf(record.model),
      wins: record.wins,
      answered: record.answered,
    }));
  }, [arena.turns, catalog]);

  return (
    <AppShell
      threadName={threadTitle}
      modelRecords={modelRecords}
      threads={threads}
      activeThreadId={activeThreadId}
      viewer={viewer}
    >
      <Arena
        catalog={catalog}
        arena={arena}
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        viewer={viewer}
      />
    </AppShell>
  );
}
