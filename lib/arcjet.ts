import arcjet, {
  detectBot,
  detectPromptInjection,
  shield,
  tokenBucket,
} from "@arcjet/next";
import { env } from "@/lib/env";

export const aj = arcjet({
  key: env.ARCJET_KEY,
  characteristics: ["userId"],
  rules: [
    shield({ mode: "LIVE" }),
    detectBot({ mode: "LIVE", allow: [] }),
    detectPromptInjection({ mode: "LIVE" }),
    tokenBucket({
      mode: "LIVE",
      capacity: 20,
      refillRate: 5,
      interval: 10,
    }),
  ],
});

/**
 * A conversation can carry several earlier caller-authored messages besides
 * the newest prompt, and every one of them reaches the model. This screens
 * those earlier messages for prompt injection without also re-consuming the
 * `aj` token bucket on every message in the conversation, one screen per
 * request is enough for rate limiting.
 */
export const ajPromptInjection = arcjet({
  key: env.ARCJET_KEY,
  characteristics: ["userId"],
  rules: [detectPromptInjection({ mode: "LIVE" })],
});
