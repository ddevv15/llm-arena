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
