import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { env } from "@/lib/env";

let client: ReturnType<typeof createOpenRouter> | null = null;

export const openrouter = () => {
  if (!client) {
    client = createOpenRouter({ apiKey: env.OPENROUTER_API_KEY });
  }
  return client;
};
