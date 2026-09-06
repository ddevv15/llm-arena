"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AppTopBar, type ModelRecord } from "@/components/app-top-bar";
import { Arena, type ComposerMode } from "@/components/arena";
import { useSidebar } from "@/components/sidebar-provider";
import { useArena } from "@/components/use-arena";
import type { CatalogModel } from "@/lib/model-catalog";
import type { FreeModelId } from "@/lib/models";
import { takePendingPrompt } from "@/lib/pending-prompt";
import {
  deriveWinRecords,
  selectDefaultModels,
  selectInitialModels,
  type ThreadDetail,
  type ViewerRole,
} from "@/lib/thread-view";

const NEW_THREAD_TITLE = "New thread";

type ThreadWorkspaceProps = {
  readonly catalog: CatalogModel[];
  /** `null` on the new-thread page — nothing has been asked yet. */
  readonly thread: ThreadDetail | null;
  /**
   * Anything other than `"owner"` renders the thread read-only. This hides
   * controls; it does not enforce anything. `/api/turns`, `/api/chat` and the
   * vote route each re-check ownership themselves, which is where the actual
   * rule lives.
   */
  readonly viewer: ViewerRole;
};

/**
 * One thread's workspace: the bar above it, and the arena itself.
 *
 * The sidebar used to be in here too. Feature #11 moved it into
 * `app/(arena)/layout.tsx` so it survives a navigation instead of being blanked
 * by every `loading.tsx` — what's left is the part that genuinely belongs to
 * one thread. The top bar's win record is still derived from the same turns the
 * answer panels render, so the two can't drift.
 *
 * Both pages that render this pass `key={thread?.id ?? "new"}`, so moving
 * between threads genuinely remounts it rather than leaving one thread's
 * state sitting under another thread's data.
 */
export function ThreadWorkspace({
  catalog,
  thread,
  viewer,
}: ThreadWorkspaceProps) {
  const { onThreadCreated: addThreadToSidebar } = useSidebar();
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

  /**
   * What the composer can do for this person, here.
   *
   * Three states rather than the `viewer` role alone, because the role can't
   * separate the two things "anonymous" means. Anonymous on the new-thread
   * page is someone about to use the product and needing an account first;
   * anonymous on somebody else's thread is a reader, and no account will ever
   * let them add a turn to it. They want opposite affordances.
   */
  const composerMode: ComposerMode =
    thread === null
      ? viewer === "anonymous"
        ? "sign-in"
        : "send"
      : viewer === "owner"
        ? "send"
        : "read-only";

  const onThreadCreated = useCallback(
    (created: { id: string; title: string }) => {
      // Swap the URL in place instead of navigating. `router.push` would
      // unmount this tree, and with it the three in-flight `fetch` readers
      // streaming the answers currently on screen. The History API changes
      // the address bar — so a reload or a shared link lands on the real
      // thread — while leaving the running streams completely alone.
      window.history.replaceState(null, "", `/thread/${created.id}`);
      setThreadTitle(created.title);
      addThreadToSidebar(created);
    },
    [addThreadToSidebar],
  );

  const arena = useArena({
    threadId: thread?.id ?? null,
    initialTurns: thread?.turns ?? [],
    onThreadCreated,
  });

  const { setPrompt } = arena;

  // Give back the prompt someone typed before they had an account.
  //
  // Signing in is a full navigation away and back, so this runs once, on the
  // way in, on the only page that can have stashed anything. It restores the
  // models too, filtered against the live catalog — the free tier can change
  // between the stash and the return, and `selectInitialModels` filters a
  // reopened thread's models for exactly the same reason.
  //
  // It deliberately does not send. The person pressed a button that opened a
  // sign-in page, not one that sent a prompt, and firing a write on the far
  // side of a redirect they never confirmed would be a surprise — the more so
  // while `open-issues.md` #5 has roughly one send in three failing.
  //
  // On the suppression below. `react-hooks/set-state-in-effect` exists to catch
  // effects that set state on every render and cascade; this one reads a
  // browser-only store once, on mount, which is the second thing the rule's own
  // message endorses ("subscribe for updates from some external system"). It
  // cannot cascade: `takePendingPrompt` removes the entry as it reads it, so a
  // second run finds nothing. The alternatives are genuinely worse rather than
  // merely more effort — `sessionStorage` cannot be read during a server render,
  // so a `useState` initializer would render one thing on the server and another
  // on the client and trip a hydration mismatch on the textarea's own value.
  //
  // Only one of the two writes below is flagged, which is worth knowing rather
  // than reading as a distinction: the rule recognises `setSelectedIds` as a
  // `useState` setter and can't see through `setPrompt`, which arrives from
  // `useArena`. Both are the same one-shot restore.
  useEffect(() => {
    if (composerMode !== "send" || thread !== null) {
      return;
    }

    const pending = takePendingPrompt();
    if (!pending) {
      return;
    }

    const available = new Set(catalog.map((model) => model.id));
    const models = pending.models.filter((model) => available.has(model));

    setPrompt(pending.prompt);
    if (models.length > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- see above
      setSelectedIds(models);
    }
  }, [catalog, composerMode, setPrompt, thread]);

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
    <>
      <AppTopBar
        threadName={threadTitle}
        modelRecords={modelRecords}
        viewer={viewer}
      />
      <main className="min-h-0 flex-1 overflow-y-auto">
        <Arena
          catalog={catalog}
          arena={arena}
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
          viewer={viewer}
          composerMode={composerMode}
        />
      </main>
    </>
  );
}
