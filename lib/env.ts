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

/**
 * Reads lazily, on first property access, so `next build`'s static route
 * analysis (which imports this module without a real request) doesn't fail.
 * The first request that actually needs a value still fails fast.
 */
export const env = new Proxy({} as Record<EnvKey, string>, {
  get: (_target, prop: string) => required(prop),
});
