import "server-only";
import { createGroq } from "@ai-sdk/groq";
import { generateText } from "ai";
import {
  classifyFailure,
  fallbackEnabled,
  fallbackModelId,
  primaryModelId,
  shouldFallback,
  type FailureKind,
} from "./model-router";
import { CHAT_PROVIDER_TIMEOUT_MS } from "./limits";

const groq = createGroq({});

/**
 * One-shot generation with the SAME policy as chat (model-router):
 * primary first, exactly one fallback attempt, and only for availability
 * failures — never for bad input, auth, or app bugs.
 */
export async function generateVariantText(args: {
  system: string;
  prompt: string;
  maxOutputTokens?: number;
}): Promise<
  | { ok: true; text: string; modelUsed: string; fallbackUsed: boolean }
  | { ok: false; kind: FailureKind; error: unknown }
> {
  const run = (modelId: string) =>
    generateText({
      model: groq(modelId),
      system: args.system,
      prompt: args.prompt,
      maxOutputTokens: args.maxOutputTokens ?? 2500,
      temperature: 0.4,
      maxRetries: 0,
      timeout: CHAT_PROVIDER_TIMEOUT_MS,
    });

  try {
    const result = await run(primaryModelId());
    return { ok: true, text: result.text, modelUsed: primaryModelId(), fallbackUsed: false };
  } catch (error) {
    const kind = classifyFailure(error);
    if (!fallbackEnabled() || !shouldFallback(kind)) return { ok: false, kind, error };
    try {
      const result = await run(fallbackModelId());
      return { ok: true, text: result.text, modelUsed: fallbackModelId(), fallbackUsed: true };
    } catch (fallbackError) {
      return { ok: false, kind: classifyFailure(fallbackError), error: fallbackError };
    }
  }
}
