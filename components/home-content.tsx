"use client";

import { useEffect } from "react";
import { Show, SignInButton, useUser } from "@clerk/nextjs";
import posthog from "posthog-js";
import {
  AppShell,
  type ModelRecord,
  type ThreadSummary,
} from "@/components/app-shell";
import { ModelPicker } from "@/components/model-picker";
import { Button } from "@/components/ui/button";
import type { CatalogModel } from "@/lib/model-catalog";

const PLACEHOLDER_THREADS: ThreadSummary[] = [
  {
    id: "1",
    title: "Which sort is actually fastest for small arrays?",
    lastActive: "2 min ago",
  },
  {
    id: "2",
    title: "Rewrite this regex so it's readable",
    lastActive: "1 hr ago",
  },
  {
    id: "3",
    title: "Explain CRDTs like I build web apps",
    lastActive: "Yesterday",
  },
  {
    id: "4",
    title: "Best Postgres index for a leaderboard query",
    lastActive: "3 days ago",
  },
];

const PLACEHOLDER_MODEL_RECORDS: ModelRecord[] = [
  { name: "Claude Sonnet 5", wins: 5 },
  { name: "GPT-5.1", wins: 3 },
  { name: "Gemini 3 Pro", wins: 2 },
];

type HomeContentProps = {
  catalog: CatalogModel[];
};

export function HomeContent({ catalog }: HomeContentProps) {
  const { isLoaded, user } = useUser();

  useEffect(() => {
    if (!isLoaded || !user) {
      return;
    }

    posthog.identify(user.id, {
      email: user.primaryEmailAddress?.emailAddress,
      name: user.fullName ?? undefined,
    });
  }, [isLoaded, user]);

  return (
    <>
      <Show when="signed-out">
        <div className="flex flex-1 items-center justify-center">
          <SignInButton>
            <button className="rounded-full bg-foreground px-5 py-3 text-background">
              Sign in
            </button>
          </SignInButton>
        </div>
      </Show>
      <Show when="signed-in">
        <AppShell
          threadName={PLACEHOLDER_THREADS[0].title}
          modelRecords={PLACEHOLDER_MODEL_RECORDS}
          threads={PLACEHOLDER_THREADS}
          activeThreadId={PLACEHOLDER_THREADS[0].id}
        >
          <div className="mx-auto flex max-w-3xl flex-col items-center gap-4 px-4 py-16 text-center">
            <h2 className="font-display text-2xl font-medium">
              Ask three models at once
            </h2>
            <p className="max-w-prose text-muted-foreground">
              The prompt box and side-by-side answers land with feature #6. This
              is the frame they&apos;ll sit inside.
            </p>
            <ModelPicker catalog={catalog} />
            <Button disabled className="mt-2">
              Ask three models
            </Button>
          </div>
        </AppShell>
      </Show>
    </>
  );
}
