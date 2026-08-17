const required = (name: string): string => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};

type EnvKey =
  | "OPENROUTER_API_KEY"
  | "CLERK_SECRET_KEY"
  | "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"
  | "ARCJET_KEY"
  | "DATABASE_URL";

const REQUIRED_ENV_KEYS: readonly EnvKey[] = [
  "OPENROUTER_API_KEY",
  "CLERK_SECRET_KEY",
  "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
  "ARCJET_KEY",
  "DATABASE_URL",
];

/**
 * Reads lazily, on first property access, so `next build`'s static route
 * analysis (which imports this module without a real request) doesn't fail.
 * `assertRequiredEnv` below is what actually fails the process fast, at real
 * server startup; this proxy just keeps every other read-site simple.
 */
export const env = new Proxy({} as Record<EnvKey, string>, {
  get: (_target, prop: string) => required(prop),
});

/**
 * Called once from `instrumentation.ts`'s `register()`, which Next.js runs
 * when a real server instance boots and must finish before it serves any
 * request — unlike `next build`'s module analysis, so this can safely be
 * eager. Missing config now crashes the server at startup instead of
 * surfacing as a 500 on whichever route happens to touch it first.
 */
export const assertRequiredEnv = (): void => {
  REQUIRED_ENV_KEYS.forEach(required);
};
