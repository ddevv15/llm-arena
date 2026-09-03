import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { PageMessage } from "@/components/page-message";
import { ThreadWorkspace } from "@/components/thread-workspace";
import { Button } from "@/components/ui/button";
import { protectPublicRead } from "@/lib/arcjet";
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
 *
 * Because it is public, this is also the one page in the app a stranger can
 * make do real work, and `getThread` reads a whole thread — every turn, every
 * answer, in full — with no pagination to bound it. So Arcjet screens the
 * request *before* that query runs, not after; guarding a read after paying
 * for it would protect nothing.
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
 *
 * The guard runs here too, and has to: this function and the page below both
 * execute for one request, so without it a turned-away reader would still get
 * their thread read out of the database to fill in a tab title. It's the same
 * cached decision the page uses, not a second one.
 */
export async function generateMetadata({
  params,
}: PageProps<"/thread/[id]">): Promise<Metadata> {
  const decision = await protectPublicRead();
  if (decision.isDenied()) {
    return {
      title: decision.reason.isRateLimit() ? "Too many requests" : "Blocked",
    };
  }

  const { id } = await params;
  const thread = await getThread(id);

  return thread ? { title: thread.title } : {};
}

export default async function ThreadPage({
  params,
}: PageProps<"/thread/[id]">) {
  const decision = await protectPublicRead();

  if (decision.isDenied()) {
    // Which rule actually turned this reader away. Worth logging rather than
    // inferring from the screen they got: a bot denial and a shield denial land
    // on the same 403 page, and the difference is what tells you whether the
    // allow-list needs a name added or something is genuinely probing.
    console.warn("Arcjet denied a thread read", {
      reason: decision.reason.type,
      deniedBy: decision.results
        .filter((result) => result.conclusion === "DENY")
        .map((result) => result.reason.type),
    });

    // A server component can't set a status code — `notFound()` is the only
    // escape hatch Next gives, and it would say 404, which is a lie about a
    // thread that exists. So these render as 200 with an honest page. The code
    // in the eyebrow is what actually tells the reader which wall they hit.
    return decision.reason.isRateLimit() ? (
      <PageMessage code="429" title="Too many requests">
        This link has been opened a lot from your network in the last minute.
        Wait a moment, then reload the page.
      </PageMessage>
    ) : (
      <PageMessage
        code="403"
        title="This request was blocked"
        action={
          <Button asChild>
            <Link href="/">Go to the arena</Link>
          </Button>
        }
      >
        The request looked automated rather than typed by a person. If that was
        wrong, open the link again in a normal browser tab.
      </PageMessage>
    );
  }

  // Arcjet failing open is the deliberate choice on a read: `isErrored()` means
  // the decision never got made (service unreachable, a cold client), and a
  // shared link going dark because a security service blinked is worse than an
  // unscreened page view. The write path at `/api/turns` makes the opposite
  // call, because a prompt there has consequences a read doesn't.
  if (decision.isErrored()) {
    console.error("Arcjet decision errored on a thread read", {
      message: decision.reason.message,
    });
  }

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
