import { auth } from "@clerk/nextjs/server";
import { ThreadWorkspace } from "@/components/thread-workspace";
import { getModelCatalog } from "@/lib/model-catalog";

/**
 * The new-thread page. It has no thread of its own — the first prompt creates
 * one, and `ThreadWorkspace` swaps the URL to `/thread/[id]` in place rather
 * than navigating, so the answers already streaming aren't cut off.
 *
 * It renders for everyone. Feature #12 removed the sign-in gate that used to
 * stand here: a signed-out visitor gets the real arena and a real composer,
 * and only pressing send asks for an account. That gate was never enforcing
 * anything — `/api/turns` answers a signed-out caller with a 401 and has done
 * since feature #6 — it was a second copy of a rule the server already held,
 * and it hid the whole app behind a single button.
 *
 * Reading `auth()` still makes this route dynamic, which it has to be: the
 * answer changes what the composer does. The OpenRouter catalog keeps its own
 * hour-long cache, and the sidebar's thread list belongs to the layout.
 */
export default async function Home() {
  const [{ userId }, catalog] = await Promise.all([auth(), getModelCatalog()]);

  return (
    <ThreadWorkspace
      key="new"
      catalog={catalog}
      thread={null}
      viewer={userId ? "owner" : "anonymous"}
    />
  );
}
