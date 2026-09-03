import { auth } from "@clerk/nextjs/server";
import { SignInPrompt } from "@/components/sign-in-prompt";
import { ThreadWorkspace } from "@/components/thread-workspace";
import { getModelCatalog } from "@/lib/model-catalog";
import { listThreads } from "@/lib/threads";

/**
 * The new-thread page. It has no thread of its own — the first prompt creates
 * one, and `ThreadWorkspace` swaps the URL to `/thread/[id]` in place rather
 * than navigating, so the answers already streaming aren't cut off.
 *
 * Reading `auth()` makes this route dynamic, which it has to be now that it
 * renders one particular person's thread list. The OpenRouter catalog keeps
 * its own hour-long cache, so that isn't re-fetched per request.
 */
export default async function Home() {
  const [{ userId }, catalog] = await Promise.all([auth(), getModelCatalog()]);

  if (!userId) {
    return <SignInPrompt />;
  }

  const threads = await listThreads(userId);

  return (
    <ThreadWorkspace
      key="new"
      catalog={catalog}
      threads={threads}
      thread={null}
      viewer="owner"
    />
  );
}
