import type { streamText } from "ai";

type StreamTextResult = ReturnType<typeof streamText>;

const sseEvent = (event: string, data: unknown): string =>
  `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

const FAILURE_MESSAGE = "This model didn't respond. Try again.";

export type StreamSettledOutcome =
  | {
      status: "COMPLETE";
      content: string;
      ttft: number | null;
      tokensPerSecond: number;
      outputTokens: number;
    }
  | { status: "ERROR" };

type ToModelSseResponseOptions = {
  /**
   * Fired exactly once, after the stream has fully settled (successfully or
   * not) but before the SSE response closes — the one place a caller can
   * durably persist the final state of this one model's answer. Errors
   * thrown here are swallowed; a persistence failure must not turn into a
   * second, malformed error event on a stream the client already read.
   */
  onSettled?: (outcome: StreamSettledOutcome) => void | Promise<void>;
};

export const toModelSseResponse = (
  result: StreamTextResult,
  requestStart: number,
  { onSettled }: ToModelSseResponseOptions = {},
): Response => {
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let firstTokenAt: number | null = null;
      let content = "";
      let settled = false;

      const settle = async (outcome: StreamSettledOutcome) => {
        if (settled) {
          return;
        }
        settled = true;
        try {
          await onSettled?.(outcome);
        } catch (error) {
          console.error("Failed to persist a settled model answer", error);
        }
      };

      try {
        for await (const part of result.fullStream) {
          if (part.type === "text-delta") {
            firstTokenAt ??= performance.now();
            content += part.text;
            controller.enqueue(
              encoder.encode(sseEvent("chunk", { text: part.text })),
            );
          } else if (part.type === "error" || part.type === "abort") {
            controller.enqueue(
              encoder.encode(sseEvent("error", { message: FAILURE_MESSAGE })),
            );
            await settle({ status: "ERROR" });
          } else if (part.type === "finish") {
            const finishAt = performance.now();
            const outputTokens = part.totalUsage.outputTokens ?? 0;
            const elapsedSeconds = (finishAt - requestStart) / 1000;
            const ttft = firstTokenAt ? firstTokenAt - requestStart : null;
            const tokensPerSecond =
              elapsedSeconds > 0 ? outputTokens / elapsedSeconds : 0;

            controller.enqueue(
              encoder.encode(
                sseEvent("done", { outputTokens, ttft, tokensPerSecond }),
              ),
            );
            await settle({
              status: "COMPLETE",
              content,
              ttft,
              tokensPerSecond,
              outputTokens,
            });
          }
        }
      } catch {
        controller.enqueue(
          encoder.encode(sseEvent("error", { message: FAILURE_MESSAGE })),
        );
        await settle({ status: "ERROR" });
      } finally {
        await settle({ status: "ERROR" });
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
