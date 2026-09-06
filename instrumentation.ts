export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { assertRequiredEnv } = await import("@/lib/env");
    assertRequiredEnv();

    // Awaited, not fired and forgotten. The point is that the app's throwaway
    // call *finishes* before a real prompt arrives — a warm-up still in flight
    // would leave the first caller racing it for the failure. It is bounded by
    // the client's own six-second deadline, so it cannot hang the boot.
    const { warmPromptInjectionRule } = await import("@/lib/arcjet");
    await warmPromptInjectionRule();
  }
}
