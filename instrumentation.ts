export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { assertRequiredEnv } = await import("@/lib/env");
    assertRequiredEnv();
  }
}
