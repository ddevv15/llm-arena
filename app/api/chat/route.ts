import { auth } from "@clerk/nextjs/server";
import { streamText } from "ai";
import { z } from "zod";
import { aj, ajPromptInjection } from "@/lib/arcjet";
import { FREE_MODEL_IDS } from "@/lib/models";
import { openrouter } from "@/lib/openrouter";
import { toModelSseResponse } from "@/lib/model-stream";

// Every earlier user turn gets its own prompt-injection screen below, in
// parallel and outside the request's own rate-limit bucket — this caps the
// conversation so that fan-out (and the request's latency and screening
// quota) stays bounded, not just its shape.
const MAX_MESSAGES = 20;

const requestSchema = z
  .object({
    model: z.enum(FREE_MODEL_IDS),
    messages: z
      .array(
        z.object({
          role: z.enum(["user", "assistant"]),
          content: z.string().min(1),
        }),
      )
      .min(1)
      .max(MAX_MESSAGES),
  })
  .refine(
    (data) =>
      data.messages.length % 2 === 1 &&
      data.messages.every(
        (message, index) =>
          message.role === (index % 2 === 0 ? "user" : "assistant"),
      ),
    {
      message: "Messages must alternate, starting and ending with the user.",
    },
  );

const humanError = (message: string, status: number) =>
  Response.json({ error: message }, { status });

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return humanError("Sign in to send a prompt.", 401);
  }

  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return humanError("That prompt couldn't be sent. Try again.", 400);
  }

  const { model, messages } = parsed.data;
  const latestUserMessage = messages[messages.length - 1].content;

  const decision = await aj.protect(request, {
    userId,
    requested: 1,
    detectPromptInjectionMessage: latestUserMessage,
  });

  if (decision.isDenied()) {
    if (decision.reason.isRateLimit()) {
      return humanError(
        "You're sending prompts faster than we can keep up. Wait a moment and try again.",
        429,
      );
    }
    if (decision.reason.isPromptInjection()) {
      return humanError(
        "That prompt couldn't be sent. Try rephrasing it.",
        400,
      );
    }
    return humanError("That prompt couldn't be sent. Try again.", 403);
  }

  // The alternating-roles check above guarantees every earlier user turn
  // sits at an even index below the last one; each of those still reaches
  // the model and needs its own injection screen, not just the newest turn.
  const earlierUserMessages = messages
    .slice(0, -1)
    .filter((message) => message.role === "user")
    .map((message) => message.content);

  const earlierDecisions = await Promise.all(
    earlierUserMessages.map((content) =>
      ajPromptInjection.protect(request, {
        userId,
        detectPromptInjectionMessage: content,
      }),
    ),
  );

  if (earlierDecisions.some((d) => d.isDenied())) {
    return humanError("That prompt couldn't be sent. Try rephrasing it.", 400);
  }

  const requestStart = performance.now();
  const result = streamText({
    model: openrouter().chat(model),
    messages,
  });

  return toModelSseResponse(result, requestStart);
}
