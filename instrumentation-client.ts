import posthog from "posthog-js";

const projectToken = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
const apiHost = process.env.NEXT_PUBLIC_POSTHOG_HOST;
const analyticsDisabled = process.env.NEXT_PUBLIC_POSTHOG_DISABLED === "true";

if (analyticsDisabled) {
  // Explicit, observable opt-out — distinct from a misconfigured deploy below.
} else if (!projectToken || !apiHost) {
  const missingVariable = !projectToken
    ? "NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN"
    : "NEXT_PUBLIC_POSTHOG_HOST";

  throw new Error(
    `${missingVariable} is required by PostHog but missing or un-configured, which would otherwise cause events to be silently dropped in every environment, including production. Set it, or set NEXT_PUBLIC_POSTHOG_DISABLED=true to opt out of analytics on purpose.`,
  );
} else {
  posthog.init(projectToken, {
    api_host: apiHost,
    defaults: "2026-01-30",
    capture_exceptions: true,
    debug: process.env.NODE_ENV === "development",
  });
}
