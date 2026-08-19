export type SseMessage = { event: string; data: unknown };

/**
 * Browsers' built-in EventSource only supports GET, and these streams are
 * POST responses — parse the same `event:`/`data:` framing `lib/model-stream`
 * writes by hand, off the fetch Response's own body reader.
 */
export async function* parseSseStream(
  response: Response,
): AsyncGenerator<SseMessage> {
  const body = response.body;
  if (!body) {
    return;
  }

  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      buffer += decoder.decode(value, { stream: true });

      const parts = buffer.split("\n\n");
      buffer = parts.pop() ?? "";

      for (const part of parts) {
        const message = parseEvent(part);
        if (message) {
          yield message;
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

function parseEvent(raw: string): SseMessage | null {
  let event = "message";
  let dataLine: string | null = null;

  for (const line of raw.split("\n")) {
    if (line.startsWith("event: ")) {
      event = line.slice("event: ".length);
    } else if (line.startsWith("data: ")) {
      dataLine = line.slice("data: ".length);
    }
  }

  if (dataLine === null) {
    return null;
  }

  try {
    return { event, data: JSON.parse(dataLine) };
  } catch {
    return null;
  }
}
