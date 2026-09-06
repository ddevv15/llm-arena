"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { usePathname } from "next/navigation";
import type { ThreadSummary } from "@/lib/thread-view";

/**
 * The sidebar's state, hoisted above the page that used to own it.
 *
 * Feature #11 moved the sidebar into `app/(arena)/layout.tsx` so a client
 * navigation keeps it mounted instead of repainting fifty thread links on
 * every click. That move splits one component across the layout/page line:
 * the drawer and the thread list now render in the layout, while the buttons
 * that open and collapse them are in the top bar, which stays with the page.
 * This context is what still lets the two agree.
 *
 * It carries state only. The thread list arrives server-rendered and is
 * seeded through `initialThreads`; nothing here fetches.
 */

type ThreadCreated = {
  readonly id: string;
  readonly title: string;
};

type SidebarValue = {
  readonly threads: readonly ThreadSummary[];
  /** Which thread the sidebar should mark as current. */
  readonly activeThreadId: string | null;
  /**
   * A brand-new thread, the moment `/api/turns` names it. This is why the
   * list is client state at all: the sidebar has to show the thread that was
   * just created without a round trip to re-read the list that created it.
   */
  readonly onThreadCreated: (thread: ThreadCreated) => void;
  /**
   * Whether anyone is signed in. The sidebar renders either way — feature #12
   * — but what fills its lower half doesn't: a thread list for someone with
   * threads, an invitation for someone without an account yet.
   */
  readonly signedIn: boolean;
  readonly mobileNavOpen: boolean;
  readonly openNav: () => void;
  readonly closeNav: () => void;
  readonly collapsed: boolean;
  readonly toggleCollapsed: () => void;
  /**
   * The top bar's hamburger, held here so the drawer in the layout can return
   * focus to it on close — the two are now in different trees.
   */
  readonly menuButtonRef: RefObject<HTMLButtonElement | null>;
};

const SidebarContext = createContext<SidebarValue | null>(null);

/** The thread id in `/thread/<id>`, or `null` anywhere else. */
const threadIdFromPath = (pathname: string): string | null =>
  /^\/thread\/([^/]+)/.exec(pathname)?.[1] ?? null;

type SidebarProviderProps = {
  readonly initialThreads: readonly ThreadSummary[];
  readonly signedIn: boolean;
  readonly children: ReactNode;
};

export function SidebarProvider({
  initialThreads,
  signedIn,
  children,
}: SidebarProviderProps) {
  const pathname = usePathname();

  const [threads, setThreads] = useState<readonly ThreadSummary[]>(
    () => initialThreads,
  );
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  // Derived, not stored. Which thread is current is already written down in
  // the URL, and the one case that looked like it needed its own state turns
  // out not to: the first prompt in a new thread doesn't navigate — it swaps
  // the URL with `history.replaceState`, so the tree isn't unmounted mid-stream
  // — and Next syncs `usePathname` with `replaceState`, so the highlight
  // follows anyway. Keeping a copy in state would only have created a second
  // answer free to disagree with the address bar.
  const activeThreadId = threadIdFromPath(pathname);

  const onThreadCreated = useCallback(({ id, title }: ThreadCreated) => {
    setThreads((current) => [
      { id, title, lastActive: "Just now" },
      ...current,
    ]);
  }, []);

  const openNav = useCallback(() => setMobileNavOpen(true), []);

  const closeNav = useCallback(() => {
    setMobileNavOpen(false);
    menuButtonRef.current?.focus();
  }, []);

  // Collapse lasts for the visit, not across visits. Restoring it from storage
  // needs the state read before first paint to avoid the sidebar animating
  // shut in front of the person, and that's a pre-hydration inline script —
  // more machinery than a nice-to-have toggle earns.
  const toggleCollapsed = useCallback(
    () => setCollapsed((current) => !current),
    [],
  );

  const value = useMemo<SidebarValue>(
    () => ({
      threads,
      activeThreadId,
      onThreadCreated,
      signedIn,
      mobileNavOpen,
      openNav,
      closeNav,
      collapsed,
      toggleCollapsed,
      menuButtonRef,
    }),
    [
      threads,
      activeThreadId,
      onThreadCreated,
      signedIn,
      mobileNavOpen,
      openNav,
      closeNav,
      collapsed,
      toggleCollapsed,
    ],
  );

  return (
    <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>
  );
}

export function useSidebar(): SidebarValue {
  const value = useContext(SidebarContext);
  if (!value) {
    throw new Error("useSidebar must be used inside the arena layout.");
  }
  return value;
}
