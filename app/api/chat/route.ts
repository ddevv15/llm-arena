import { auth } from "@clerk/nextjs/server";
import { streamText } from "ai";
import { z } from "zod";
import { aj } from "@/lib/arcjet";
import { openrouter } from "@/lib/openrouter";
import { toModelSseResponse } from "@/lib/model-stream";

const requestSchema = z.object({
  model: z.string().min(1),
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1),
      }),
    )
    .min(1),
});

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

  const requestStart = performance.now();
  const result = streamText({
    model: openrouter().chat(model),
    messages,
  });

  return toModelSseResponse(result, requestStart);
}
