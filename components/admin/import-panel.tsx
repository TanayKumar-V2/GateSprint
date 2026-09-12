"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";

type ImportResponse = { importedCount?: number; skippedCount?: number; skipped?: { externalId: string; reason: string }[]; error?: { message?: string } };

export function ImportPanel() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function importPdf() {
    if (!file) return;
    setBusy(true);
    setNotice(null);
    try {
      const form = new FormData();
      form.set("file", file);
      const extraction = await fetch("/api/admin/pdf-import", { method: "POST", body: form });
      const extracted = await extraction.json() as { questions?: unknown[]; error?: { message?: string } };
      if (!extraction.ok || !Array.isArray(extracted.questions)) {
        setNotice(extracted.error?.message ?? "Could not extract questions from this PDF.");
        return;
      }
      const response = await fetch("/api/admin/imports", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ questions: extracted.questions }) });
      const data = await response.json() as ImportResponse;
      if (!response.ok) {
        setNotice(data.error?.message ?? "Questions were extracted but could not be imported.");
        return;
      }
      const reasons = (data.skipped ?? []).slice(0, 5).map((item) => item.externalId + ": " + item.reason).join(" • ");
      setNotice("Extracted " + extracted.questions.length + " questions. Imported " + (data.importedCount ?? 0) + " drafts and skipped " + (data.skippedCount ?? 0) + "." + (reasons ? " Skips: " + reasons : " Review them below before publishing."));
    } catch {
      setNotice("The upload failed. Check that the PDF is readable and try again.");
    } finally {
      setBusy(false);
    }
  }

  return <section className="mb-8 rounded-2xl border border-border bg-muted/30 p-5 sm:p-6">
    <div className="max-w-2xl">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">GATE paper ingestion</p>
      <h2 className="mt-2 text-xl font-semibold">Upload a question-paper PDF</h2>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">The app extracts the questions, maps them to the current subject/topic list, and saves them as unpublished drafts. You can review, edit, and publish them from the question bank.</p>
    </div>
    <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
      <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="block w-full rounded-xl border border-input bg-background px-3 py-2 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-sm file:font-medium" onChange={(event) => { setFile(event.target.files?.[0] ?? null); setNotice(null); }} />
      <Button type="button" className="shrink-0" onClick={() => void importPdf()} disabled={busy || !file}>{busy ? "Extracting…" : "Extract questions"}</Button>
    </div>
    <div className="mt-3 flex flex-wrap items-center gap-3">
      {file ? <p className="text-xs text-muted-foreground">Selected: {file.name}</p> : <p className="text-xs text-muted-foreground">Searchable PDFs up to 20 MB. Scanned PDFs need OCR first.</p>}
      {file ? <button type="button" className="text-xs font-medium text-muted-foreground underline underline-offset-4" onClick={() => { setFile(null); setNotice(null); if (inputRef.current) inputRef.current.value = ""; }}>Remove</button> : null}
    </div>
    {notice ? <p className="mt-4 rounded-xl border border-border bg-background px-3 py-3 text-sm leading-6 text-muted-foreground">{notice}</p> : null}
  </section>;
}
