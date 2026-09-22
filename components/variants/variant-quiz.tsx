"use client";

import { useCallback, useEffect, useState } from "react";
import type { VariantListItem } from "@/lib/variants";
import { VARIANTS_UPDATED } from "./variant-client";
import { VariantCard } from "./variant-card";

/** Session variant list: re-fetches when a new set lands. No answers here. */
export function VariantQuiz({
  sessionId,
  initial,
}: {
  sessionId: string;
  initial: VariantListItem[];
}) {
  const [variants, setVariants] = useState(initial);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/chat/sessions/${sessionId}/variants`);
      if (!res.ok) return;
      const data = (await res.json()) as { variants: VariantListItem[] };
      if (Array.isArray(data.variants)) setVariants(data.variants);
    } catch {
      // The server-rendered list stays; next navigation refreshes.
    }
  }, [sessionId]);

  useEffect(() => {
    window.addEventListener(VARIANTS_UPDATED, refresh);
    return () => window.removeEventListener(VARIANTS_UPDATED, refresh);
  }, [refresh]);

  if (variants.length === 0) {
    return (
      <p className="crt-micro border border-(--crt-line) p-4 text-center text-[10px] leading-relaxed text-(--crt-dim)">
        NO VARIANTS YET — GENERATE A SET ABOVE OR TYPE /QUIZ.
      </p>
    );
  }

  return (
    <ol className="flex flex-col gap-4">
      {variants.map((v) => (
        <VariantCard key={v.id} variant={v} />
      ))}
    </ol>
  );
}
