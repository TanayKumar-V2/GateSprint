import { createGroq } from "@ai-sdk/groq";
import {
  APICallError,
  createUIMessageStreamResponse,
  generateText,
  streamText,
  type ModelMessage,
  type UIMessageChunk,
} from "ai";
import { logSecurityEvent } from "../security/events";

/* ---------- Configuration (env-overridable, no code changes) ---------- */

export function primaryModelId(): string {
  return process.env.GROQ_PRIMARY_MODEL ?? "openai/gpt-oss-20b";
}

export function fallbackModelId(): string {
  return process.env.GROQ_FALLBACK_MODEL ?? "openai/gpt-oss-120b";
}

export function fallbackEnabled(): boolean {
  return (process.env.GROQ_FALLBACK_ENABLED ?? "true") !== "false";
}

const groq = createGroq({});

/** One-shot structured generation for admin ingestion jobs. */
export async function generateImportText(args: {
  system: string;
  prompt: string;
  maxOutputTokens?: number;
  /**
   * Pin to one model (single attempt, throws on failure). Used for the
   * grader's second draw after the primary's output failed validation —
   * the default path already spent its own fallback, if any.
   */
  modelId?: string;
}): Promise<string> {
  const run = async (modelId: string) => {
    const result = await generateText({
      model: groq(modelId),
      system: args.system,
      prompt: args.prompt,
      maxOutputTokens: args.maxOutputTokens ?? 6000,
      temperature: 0,
      maxRetries: 0,
      timeout: 90000,
    });
    return result.text;
  };
  if (args.modelId) return run(args.modelId);
  try {
    return await run(primaryModelId());
  } catch (error) {
    if (!fallbackEnabled()) throw error;
    return run(fallbackModelId());
  }
}

/* ---------- Failure classification ---------- */

export type FailureKind =
  | "model-unavailable" // 404 model-not-found from the provider
  | "overloaded" // 429 provider rate limit, 503, timeouts, network errors
  | "server-error" // other provider 5xx
  | "invalid-request" // 400/422, bad prompt — never fall back
  | "auth-error" // 401/403, missing key — never fall back
  | "app-error" // SDK/config bugs — never fall back
  | "cancelled"; // client went away — never fall back

export function classifyFailure(error: unknown): FailureKind {
  const message = (
    error instanceof Error ? error.message : String(error)
  ).toLowerCase();
  const name = error instanceof Error ? error.name : "";

  if (
    name === "AbortError" ||
    message.includes("aborted") ||
    message.includes("cancelled") ||
    message.includes("canceled")
  )
    return "cancelled";
  if (name.includes("Timeout")) return "overloaded";

  let status: number | undefined;
  if (error instanceof APICallError && typeof error.statusCode === "number") {
    status = error.statusCode;
  } else if (
    error !== null &&
    typeof error === "object" &&
    "statusCode" in error &&
    typeof (error as { statusCode: unknown }).statusCode === "number"
  ) {
    status = (error as { statusCode: number }).statusCode;
  }

  const isTimeout =
    message.includes("timed out") ||
    message.includes("timeout") ||
    message.includes("etimedout") ||
    message.includes("enotfound") ||
    message.includes("econnreset") ||
    message.includes("fetch failed") ||
    message.includes("network");

  if (
    status === 404 &&
    (message.includes("model") || message.includes("not found"))
  )
    return "model-unavailable";
  if (status === 429 || status === 503 || (status === undefined && isTimeout))
    return "overloaded";
  if (status !== undefined && status >= 500) return "server-error";
  if (status === 400 || status === 422) return "invalid-request";
  if (status === 401 || status === 403) return "auth-error";
  if (isTimeout) return "overloaded";
  return "app-error";
}

/** Exactly one retry, and only for availability failures. */
export function shouldFallback(kind: FailureKind): boolean {
  return (
    kind === "model-unavailable" ||
    kind === "overloaded" ||
    kind === "server-error"
  );
}

/* ---------- Streaming with fallback ----------
 *
 *Two SDK behaviors shape this design (both verified against the installed
 * version at implementation time):
 *
 * 1. Stream errors are NOT delivered to stream consumers — a failed
 *    generation just ends the stream with zero text, while the cause only
 *    reaches `result.text` (as NoOutputGeneratedError) and the server log.
 * 2. `generateText`, by contrast, rejects with the real, classifiable
 *    provider error.
 *
 * So each model gets: stream until the first text arrives (commit — the
 * provider is healthy), or the stream ends empty (probe the same model
 * with a 1-token non-streaming call to learn the real failure, then
 * either fall back once or fail fast). The student never sees a broken
 * or empty stream from a dead primary.
 */

export type PersistOutcome = (
  text: string,
  info: {
    modelUsed: string;
    fallbackUsed: boolean;
    status: "completed" | "interrupted" | "failed";
  },
) => Promise<void>;

type GenArgs = {
  system: string;
  messages: ModelMessage[];
  maxOutputTokens: number;
  temperature: number;
  abortSignal?: AbortSignal;
  timeoutMs: number;
};

function textOf(chunk: UIMessageChunk): string {
  if (
    chunk !== null &&
    typeof chunk === "object" &&
    "delta" in chunk &&
    typeof (chunk as { delta: unknown }).delta === "string"
  ) {
    return (chunk as { delta: string }).delta;
  }
  return "";
}

function isTerminal(chunk: UIMessageChunk): boolean {
  const type =
    chunk !== null && typeof chunk === "object"
      ? String((chunk as { type?: unknown }).type ?? "")
      : "";
  return type.includes("finish") || type === "text-end" || type === "error";
}

type ModelStart =
  | {
      status: "streaming";
      modelId: string;
      buffered: UIMessageChunk[];
      reader: ReadableStreamDefaultReader<UIMessageChunk>;
    }
  | { status: "failed"; kind: FailureKind; error: unknown };

async function probeFailure(
  args: GenArgs,
  modelId: string,
): Promise<{ kind: FailureKind; error: unknown }> {
  try {
    await generateText({
      model: groq(modelId),
      system: args.system,
      messages: args.messages,
      maxOutputTokens: 1,
      temperature: 0,
      abortSignal: args.abortSignal,
      timeout: args.timeoutMs,
      maxRetries: 0,
    });
    // Model answers fine — the empty stream was a transient blip.
    // Treat it as an availability event so the fallback still serves.
    return { kind: "overloaded", error: new Error("empty stream from healthy model") };
  } catch (error) {
    return { kind: classifyFailure(error), error };
  }
}

async function startModel(
  args: GenArgs,
  modelId: string,
): Promise<ModelStart> {
  const result = streamText({
    model: groq(modelId),
    system: args.system,
    messages: args.messages,
    maxOutputTokens: args.maxOutputTokens,
    temperature: args.temperature,
    abortSignal: args.abortSignal,
    timeout: args.timeoutMs,
    maxRetries: 0, // one clean attempt per model; the fallback is the only retry
  });
  // Swallow the derived promise: failures are observed on the stream.
  result.text.then(
    () => undefined,
    () => undefined,
  );

  // Pull just far enough to prove the provider is alive: the first text
  // chunk commits us to this model. Buffered chunks are replayed below,
  // so the student sees every token exactly once — one generation total.
  const reader = result.toUIMessageStream().getReader();
  const buffered: UIMessageChunk[] = [];
  try {
    for (;;) {
      const next = await reader.read();
      if (next.done) break;
      buffered.push(next.value);
      if (textOf(next.value) !== "") {
        return { status: "streaming", modelId, buffered, reader };
      }
    }
  } catch {
    // Reads that throw still end up classified through the probe below.
  }
  reader.releaseLock();
  // Ended with zero text: learn the real cause cheaply, then decide.
  const probed = await probeFailure(args, modelId);
  return { status: "failed", ...probed };
}

export type StreamReady =
  | {
      ok: true;
      response: Response;
      modelUsed: string;
      fallbackUsed: boolean;
    }
  | { ok: false; kind: FailureKind; error: unknown };

export async function streamWithFallback(
  args: GenArgs & { persist: PersistOutcome },
): Promise<StreamReady> {
  const primary = primaryModelId();

  let committed: Extract<ModelStart, { status: "streaming" }> | null = null;
  let fallbackUsed = false;

  const first = await startModel(args, primary);
  if (first.status === "failed") {
    if (!fallbackEnabled() || !shouldFallback(first.kind)) {
      return { ok: false, kind: first.kind, error: first.error };
    }
    const fallback = fallbackModelId();
    logSecurityEvent({
      category: "provider-fallback",
      detail: `primary=${primary} kind=${first.kind}`,
    });
    const second = await startModel(args, fallback);
    if (second.status === "failed") {
      return { ok: false, kind: second.kind, error: second.error };
    }
    committed = second;
    fallbackUsed = true;
  } else {
    committed = first;
  }

  const { buffered, reader, modelId: modelUsed } = committed;

  // Forward the validated stream on the SAME generation, collecting text
  // as it flows. Persistence runs before the stream closes, so the saved
  // message always matches what the student actually received.
  const stream = new ReadableStream<UIMessageChunk>({
    async start(controller) {
      let text = "";
      let finished = false;
      const finish = async (status: "completed" | "interrupted" | "failed") => {
        try {
          await args.persist(text, {
            modelUsed,
            fallbackUsed,
            status,
          });
        } catch {
          // Persistence must never break an already-delivered reply.
        }
      };
      const note = (chunk: UIMessageChunk) => {
        text += textOf(chunk);
        if (isTerminal(chunk)) finished = true;
      };
      try {
        for (const chunk of buffered) {
          note(chunk);
          controller.enqueue(chunk);
        }
        for (;;) {
          const next = await reader.read();
          if (next.done) break;
          note(next.value);
          controller.enqueue(next.value);
        }
        await finish(finished ? "completed" : "interrupted");
        controller.close();
      } catch (error) {
        const kind = classifyFailure(error);
        await finish(kind === "cancelled" ? "interrupted" : "failed");
        controller.error(error);
      } finally {
        reader.releaseLock();
      }
    },
    cancel() {
      void reader.cancel().catch(() => undefined);
    },
  });

  return {
    ok: true,
    response: createUIMessageStreamResponse({ stream }),
    modelUsed,
    fallbackUsed,
  };
}
