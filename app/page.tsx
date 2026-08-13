"use client";

import { useEffect } from "react";
import { Show, SignInButton, UserButton, useUser } from "@clerk/nextjs";
import posthog from "posthog-js";

export default function Home() {
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
    <div className="flex flex-1 items-center justify-center">
      <Show when="signed-out">
        <SignInButton>
          <button className="rounded-full bg-foreground px-5 py-3 text-background">
            Sign in
          </button>
        </SignInButton>
      </Show>
      <Show when="signed-in">
        <div className="flex items-center gap-4">
          <UserButton />
          <span>Signed in{user ? ` as ${user.primaryEmailAddress?.emailAddress}` : ""}</span>
        </div>
      </Show>
    </div>
  );
}
