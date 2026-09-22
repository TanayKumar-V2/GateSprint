"use client";

/** Refetch signal for the session variant list. */
export const VARIANTS_UPDATED = "variants:updated";
/** Ask the chat thread to explain a variant. */
export const EXPLAIN_VARIANT = "mentor:explain";

export async function requestVariantSet(
  sessionId: string,
  body: { count?: number; difficulty?: "easy" | "medium" | "hard" } = {},
): Promise<{ ok: true; count: number } | { ok: false; message: string }> {
  try {
    const res = await fetch(`/api/chat/sessions/${sessionId}/variants`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json()) as {
      variants?: unknown[];
      error?: { message?: string };
    };
    if (!res.ok || !Array.isArray(data.variants)) {
      return { ok: false, message: data.error?.message ?? "Couldn't generate variants." };
    }
    return { ok: true, count: data.variants.length };
  } catch {
    return { ok: false, message: "Network hiccup — try again." };
  }
}

export function notifyVariantsUpdated(): void {
  window.dispatchEvent(new Event(VARIANTS_UPDATED));
}

export function askMentorToExplain(text: string): void {
  window.dispatchEvent(new CustomEvent<string>(EXPLAIN_VARIANT, { detail: text }));
}
