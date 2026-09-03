"use client";

import { useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import posthog from "posthog-js";

/**
 * Ties PostHog's session to the signed-in Clerk user, so events land on a real
 * person instead of an anonymous id.
 *
 * Rendered once from the root layout rather than from a page: every signed-in
 * screen needs it, and the thread pages would otherwise each have to remember
 * to do it themselves.
 */
export function IdentifyUser() {
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

  return null;
}
