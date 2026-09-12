import type { UIMessageChunk } from "ai";

/**
 * Minimal SSE reader for the UI message stream our chat API returns.
 * Each event is `data: <UIMessageChunk JSON>`. Malformed lines are
 * skipped; the stream simply ends wherever the server stopped.
 */
export async function* readUIChunks(
  stream: ReadableStream<Uint8Array>,
): AsyncGenerator<UIMessageChunk> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split("\n\n");
      buffer = parts.pop() ?? "";
      for (const part of parts) {
        for (const line of part.split("\n")) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const payload = trimmed.slice(5).trim();
          if (payload === "" || payload === "[DONE]") continue;
          try {
            yield JSON.parse(payload) as UIMessageChunk;
          } catch {
            // Skip undecodable lines; the message stays consistent.
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
