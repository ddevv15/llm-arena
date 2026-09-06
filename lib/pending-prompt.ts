import { MAX_SELECTED_MODELS, type FreeModelId } from "@/lib/models";

/**
 * A prompt someone typed before they had an account, held across the trip
 * through Clerk.
 *
 * Signing in is a full navigation away and back, so every piece of React state
 * on the page is gone by the time they return. Without this, asking someone to
 * sign in would silently cost them what they just typed — the same failure
 * feature #11 went out of its way to avoid when a send 503s, and it would be
 * odd to fix it there and reintroduce it here.
 *
 * `sessionStorage` rather than `localStorage`: this is meaningful for exactly
 * one round trip in one tab, and a prompt still sitting there next week would
 * be a surprise rather than a convenience. It is also never put in the URL,
 * which would hand the text to Clerk as a redirect parameter and write it into
 * browser history.
 *
 * Every access is wrapped. A browser that refuses storage (private mode, a
 * blocked origin) throws on read *and* write, and the composer must not go
 * down with it — the worst case here is the prompt isn't there afterwards,
 * which is exactly where we'd be with no stash at all.
 */

const STORAGE_KEY = "llm-arena:pending-prompt";

export type PendingPrompt = {
  readonly prompt: string;
  readonly models: readonly FreeModelId[];
};

/** Narrow unknown parsed JSON back to a `PendingPrompt`, or reject it. */
const parsePendingPrompt = (value: unknown): PendingPrompt | null => {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const { prompt, models } = value as Record<string, unknown>;

  if (typeof prompt !== "string" || prompt.length === 0) {
    return null;
  }
  if (
    !Array.isArray(models) ||
    models.length === 0 ||
    models.length > MAX_SELECTED_MODELS ||
    !models.every((model): model is FreeModelId => typeof model === "string")
  ) {
    return null;
  }

  return { prompt, models };
};

export function savePendingPrompt(pending: PendingPrompt): void {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(pending));
  } catch {
    // Storage refused. The sign-in still has to happen; they just lose the
    // draft, which is what would have happened anyway.
  }
}

/**
 * Read the stashed prompt and remove it in one go.
 *
 * Taking rather than getting, because a prompt that survived a second
 * navigation would reappear under someone who has moved on. It is consumed by
 * whoever gets there first, once.
 *
 * The models are returned as stored and are *not* trusted to still be
 * sensible: the free-tier allowlist can change between the stash and the
 * restore, so the caller filters against the live catalog exactly as
 * `selectInitialModels` does for a reopened thread.
 */
export function takePendingPrompt(): PendingPrompt | null {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (raw === null) {
      return null;
    }
    window.sessionStorage.removeItem(STORAGE_KEY);
    return parsePendingPrompt(JSON.parse(raw));
  } catch {
    return null;
  }
}
