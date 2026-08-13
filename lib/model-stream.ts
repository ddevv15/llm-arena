import type { streamText } from "ai";

type StreamTextResult = ReturnType<typeof streamText>;

const sseEvent = (event: string, data: unknown): string =>
  `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

const FAILURE_MESSAGE = "This model didn't respond. Try again.";

export const toModelSseResponse = (
  result: StreamTextResult,
  requestStart: number,
): Response => {
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let firstTokenAt: number | null = null;

      try {
        for await (const part of result.fullStream) {
          if (part.type === "text-delta") {
            firstTokenAt ??= performance.now();
            controller.enqueue(
              encoder.encode(sseEvent("chunk", { text: part.text })),
            );
          } else if (part.type === "error" || part.type === "abort") {
            controller.enqueue(
              encoder.encode(sseEvent("error", { message: FAILURE_MESSAGE })),
            );
          } else if (part.type === "finish") {
            const finishAt = performance.now();
            const outputTokens = part.totalUsage.outputTokens ?? 0;
            const elapsedSeconds = (finishAt - requestStart) / 1000;

            controller.enqueue(
              encoder.encode(
                sseEvent("done", {
                  outputTokens,
                  ttft: firstTokenAt ? firstTokenAt - requestStart : null,
                  tokensPerSecond:
                    elapsedSeconds > 0 ? outputTokens / elapsedSeconds : 0,
                }),
              ),
            );
          }
        }
      } catch {
        controller.enqueue(
          encoder.encode(sseEvent("error", { message: FAILURE_MESSAGE })),
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
};
