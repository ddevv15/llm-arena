import { SignInButton } from "@clerk/nextjs";

/**
 * The gate on the new-thread page, and only there. No shell around it — there
 * is no thread list to show and no arena to use until Clerk knows who's
 * asking.
 *
 * A shared thread deliberately does not use this: `/thread/[id]` renders for
 * anyone, signed in or not, and offers its own sign-in that returns the reader
 * to the thread they were on.
 */
export function SignInPrompt() {
  return (
    <div className="flex flex-1 items-center justify-center p-4">
      <SignInButton>
        <button className="rounded-sm bg-primary px-5 py-3 font-medium text-primary-foreground">
          Sign in
        </button>
      </SignInButton>
    </div>
  );
}
