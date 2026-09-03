import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { ThreadWorkspace } from "@/components/thread-workspace";
import { getModelCatalog } from "@/lib/model-catalog";
import { getThread, listThreads } from "@/lib/threads";
import type { ViewerRole } from "@/lib/thread-view";

/**
 * One thread, read back from Postgres: every past prompt, each model's answer,
 * its receipt, and the winner if that turn was voted on.
 *
 * Anyone holding the link can read this, signed in or not — that is what makes
 * a thread worth sharing. What it means to *use* it is unchanged: the composer
 * and the vote buttons belong to the owner, and every write route re-checks
 * that for itself rather than trusting this page to have hidden a button.
 *
 * A thread that isn't there is a plain 404 for everybody, owner included.
 */

/**
 * The tab title carries the thread's own name, so a shared link is legible in
 * a tab strip or a bookmark instead of reading "LLM Arena" like every other
 * page. `getThread` is `cache()`d, so this costs no extra query.
 *
 * Deliberately not link-preview cards — scope.md keeps those out for now.
 *
 * A missing thread returns nothing rather than its own title: `notFound()`
 * hands rendering to `app/not-found.tsx`, and Next takes the metadata from
 * there, so a title set here would be silently discarded.
 */
export async function generateMetadata({
  params,
}: PageProps<"/thread/[id]">): Promise<Metadata> {
  const { id } = await params;
  const thread = await getThread(id);

  return thread ? { title: thread.title } : {};
}

export default async function ThreadPage({
  params,
}: PageProps<"/thread/[id]">) {
  const [{ id }, { userId }] = await Promise.all([params, auth()]);

  const [catalog, thread, threads] = await Promise.all([
    getModelCatalog(),
    getThread(id),
    // A signed-out visitor has no history to list, and asking for one would be
    // a query guaranteed to come back empty.
    userId ? listThreads(userId) : [],
  ]);

  if (!thread) {
    notFound();
  }

  // `ownerId` is compared here and goes no further. Everything below this line
  // is serialized into a page anyone can open, and the owner's Clerk id is not
  // something a reader needs or should get.
  const { ownerId, ...detail } = thread;
  const viewer: ViewerRole = !userId
    ? "anonymous"
    : ownerId === userId
      ? "owner"
      : "visitor";

  return (
    <ThreadWorkspace
      key={detail.id}
      catalog={catalog}
      threads={threads}
      thread={detail}
      viewer={viewer}
    />
  );
}
