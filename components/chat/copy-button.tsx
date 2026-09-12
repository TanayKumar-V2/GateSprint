"use client";

import { useState } from "react";

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-live="polite"
      className="rounded-md border border-input bg-background px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground"
    >
      {copied ? "Copied ✓" : "Copy"}
    </button>
  );
}
