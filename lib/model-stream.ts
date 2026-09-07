import type { streamText } from "ai";

type StreamTextResult = ReturnType<typeof streamText>;

const sseEvent = (event: string, data: unknown): string =>
  `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

const FAILURE_MESSAGE = "This model didn't respond. Try again.";

export type StreamSettledOutcome =
  | {
      status: "COMPLETE";
      content: string;
      /**
       * Milliseconds to the first *visible* delta. Unchanged in meaning from
       * before feature #13, deliberately, so the rows already on disk still
       * mean what they said.
       */
      ttft: number | null;
      /**
       * Milliseconds to the first delta of any kind, reasoning included. This
       * is the one that compares across models: a model that thinks before it
       * speaks is doing work the moment this stops, and `ttft` alone reported
       * that work as dead air.
       */
      ttfo: number | null;
      tokensPerSecond: number;
      /** The provider's total, reasoning included. */
      outputTokens: number;
      /** The answer alone. `null` when the provider doesn't break it down. */
      textTokens: number | null;
      /** The thinking alone. `null` when the provider doesn't break it down. */
      reasoningTokens: number | null;
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
      // Two clocks, because one number cannot be both comparable and true to
      // the reader. `firstOutputAt` stops when the model starts working at
      // all; `firstTextAt` stops when a person first sees something. For a
      // model that doesn't reason they are the same instant.
      let firstOutputAt: number | null = null;
      let firstTextAt: number | null = null;
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
          if (part.type === "reasoning-delta") {
            // Not appended to `content` and not sent to the browser: this is
            // the model thinking, not its answer. It is here only to stop the
            // first clock, which is the whole of what was wrong before —
            // `ttft` ran straight through the reasoning phase, so a model that
            // reasons for two minutes reported two minutes to first token.
            firstOutputAt ??= performance.now();
          } else if (part.type === "text-delta") {
            const now = performance.now();
            firstOutputAt ??= now;
            firstTextAt ??= now;
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
            const ttft = firstTextAt ? firstTextAt - requestStart : null;
            const ttfo = firstOutputAt ? firstOutputAt - requestStart : null;

            // Throughput stays measured on the provider's total, reasoning
            // included: it is work done per second, and that is the fair
            // reading across a model that thinks and one that doesn't. What
            // changes is that the receipt can now say what is inside it.
            const tokensPerSecond =
              elapsedSeconds > 0 ? outputTokens / elapsedSeconds : 0;

            // Optional at runtime whatever the types say — this is a provider
            // field arriving over the wire, and a provider that omits the
            // breakdown should leave the rows blank rather than report zero,
            // which would read as "no reasoning" instead of "not reported".
            const details = part.totalUsage.outputTokenDetails;
            const textTokens = details?.textTokens ?? null;
            const reasoningTokens = details?.reasoningTokens ?? null;

            const metrics = {
              outputTokens,
              textTokens,
              reasoningTokens,
              ttft,
              ttfo,
              tokensPerSecond,
            };

            controller.enqueue(encoder.encode(sseEvent("done", metrics)));
            await settle({ status: "COMPLETE", content, ...metrics });
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
