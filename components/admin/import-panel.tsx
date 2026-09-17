"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";

type SkipEntry = { externalId: string; reason: string };
type ImportResponse = { importedCount?: number; skippedCount?: number; needsReviewCount?: number; figureCount?: number; skipped?: SkipEntry[]; warnings?: SkipEntry[]; error?: { message?: string } };

function summarize(data: ImportResponse, extractedCount: number | null): string {
  const needsReview = data.needsReviewCount ?? (data.warnings ?? []).length;
  const reviewNote = needsReview > 0 ? " " + needsReview + " question(s) need attention — see details below." : "";
  const figureNote = (data.figureCount ?? 0) > 0 ? " " + data.figureCount + " figure(s) saved with the questions." : "";
  const head = extractedCount === null
    ? "Published " + (data.importedCount ?? 0) + " questions and skipped " + (data.skippedCount ?? 0) + "."
    : "Extracted " + extractedCount + " questions. Published " + (data.importedCount ?? 0) + " questions and skipped " + (data.skippedCount ?? 0) + ".";
  const tail = (data.skippedCount ?? 0) === 0 && needsReview === 0 ? " They are live in Practice now." : "";
  return head + reviewNote + figureNote + tail;
}

export function ImportPanel() {
  const pdfRef = useRef<HTMLInputElement>(null);
  const jsonRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [jsonFile, setJsonFile] = useState<File | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [skipped, setSkipped] = useState<SkipEntry[]>([]);
  const [warnings, setWarnings] = useState<SkipEntry[]>([]);
  const [extraction, setExtraction] = useState<unknown[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [jsonBusy, setJsonBusy] = useState(false);

  function report(data: ImportResponse, extractedCount: number | null, engineNote?: string) {
    setSkipped(data.skipped ?? []);
    setWarnings(data.warnings ?? []);
    setNotice(summarize(data, extractedCount) + (engineNote ? " " + engineNote : ""));
  }

  async function postQuestions(questions: unknown[]) {
    const response = await fetch("/api/admin/imports", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ questions }) });
    const data = await response.json() as ImportResponse;
    if (!response.ok) {
      setNotice(data.error?.message ?? "Questions were extracted but could not be imported.");
      return null;
    }
    return data;
  }

  async function importPdf() {
    if (!file) return;
    setBusy(true);
    setNotice(null);
    setSkipped([]);
    setWarnings([]);
    try {
      const form = new FormData();
      form.set("file", file);
      const res = await fetch("/api/admin/pdf-import", { method: "POST", body: form });
      const extracted = await res.json() as { questions?: unknown[]; engine?: string; engineNote?: string; error?: { message?: string } };
      if (!res.ok || !Array.isArray(extracted.questions)) {
        setNotice(extracted.error?.message ?? "Could not extract questions from this PDF.");
        return;
      }
      setExtraction(extracted.questions);
      const data = await postQuestions(extracted.questions);
      if (data) report(data, extracted.questions.length, extracted.engineNote);
    } catch {
      setNotice("The upload failed. Check that the PDF is readable and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function importJson() {
    if (!jsonFile) return;
    setJsonBusy(true);
    setNotice(null);
    setSkipped([]);
    setWarnings([]);
    try {
      const text = await jsonFile.text();
      let parsed: unknown;
      try {
        parsed = JSON.parse(text) as unknown;
      } catch {
        setNotice(jsonFile.name + " is not valid JSON.");
        return;
      }
      const questions = Array.isArray(parsed)
        ? parsed
        : parsed && typeof parsed === "object" && Array.isArray((parsed as { questions?: unknown }).questions)
          ? (parsed as { questions: unknown[] }).questions
          : null;
      if (!questions) {
        setNotice("JSON must be {\"questions\": [...]} or a plain [...] array of questions.");
        return;
      }
      setExtraction(questions);
      const data = await postQuestions(questions);
      if (data) report(data, null);
    } catch {
      setNotice("Could not read that JSON file.");
    } finally {
      setJsonBusy(false);
    }
  }

  function downloadExtraction() {
    if (!extraction) return;
    const blob = new Blob([JSON.stringify({ questions: extraction }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "extracted-questions.json";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  return <section className="mb-8 rounded-2xl border border-border bg-muted/30 p-5 sm:p-6">
    <div className="max-w-2xl">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">GATE paper ingestion</p>
      <h2 className="mt-2 text-xl font-semibold">Upload a question-paper PDF</h2>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">The app extracts the questions, maps them to the current subject/topic list, and publishes them straight to Practice. You can still edit or unpublish anything from the question bank.</p>
    </div>
    <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
      <input ref={pdfRef} type="file" accept="application/pdf,.pdf" className="block w-full rounded-xl border border-input bg-background px-3 py-2 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-sm file:font-medium" onChange={(event) => { setFile(event.target.files?.[0] ?? null); setNotice(null); }} />
      <Button type="button" className="shrink-0" onClick={() => void importPdf()} disabled={busy || !file}>{busy ? "Extracting…" : "Extract questions"}</Button>
    </div>
    <div className="mt-3 flex flex-wrap items-center gap-3">
      {file ? <p className="text-xs text-muted-foreground">Selected: {file.name}</p> : <p className="text-xs text-muted-foreground">Searchable PDFs up to 20 MB. Scanned PDFs need OCR first.</p>}
      {file ? <button type="button" className="text-xs font-medium text-muted-foreground underline underline-offset-4" onClick={() => { setFile(null); setNotice(null); if (pdfRef.current) pdfRef.current.value = ""; }}>Remove</button> : null}
      {extraction ? <button type="button" className="text-xs font-medium text-muted-foreground underline underline-offset-4" onClick={downloadExtraction}>Download extraction JSON ({extraction.length})</button> : null}
    </div>
    <div className="mt-6 border-t border-border pt-5">
      <h3 className="text-sm font-semibold">Or import a fixed JSON file</h3>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">Download the extraction above (or build your own <span className="font-mono text-xs">{'"questions": [...]'}</span> file — see <span className="font-mono text-xs">tools/extract</span> for the fast Python PDF extractor), fix any bad rows, and import it directly — no re-extraction needed.</p>
      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
        <input ref={jsonRef} type="file" accept="application/json,.json" className="block w-full rounded-xl border border-input bg-background px-3 py-2 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-sm file:font-medium" onChange={(event) => { setJsonFile(event.target.files?.[0] ?? null); setNotice(null); }} />
        <Button type="button" variant="secondary" className="shrink-0" onClick={() => void importJson()} disabled={jsonBusy || !jsonFile}>{jsonBusy ? "Importing…" : "Import JSON"}</Button>
      </div>
      {jsonFile ? <div className="mt-3 flex flex-wrap items-center gap-3">
        <p className="text-xs text-muted-foreground">Selected: {jsonFile.name}</p>
        <button type="button" className="text-xs font-medium text-muted-foreground underline underline-offset-4" onClick={() => { setJsonFile(null); setNotice(null); if (jsonRef.current) jsonRef.current.value = ""; }}>Remove</button>
      </div> : null}
    </div>
    {notice ? <p className="mt-4 rounded-xl border border-border bg-background px-3 py-3 text-sm leading-6 text-muted-foreground">{notice}</p> : null}
    {warnings.length > 0 ? <details className="mt-3 rounded-xl border border-border bg-background px-3 py-3 text-sm leading-6 text-muted-foreground">
      <summary className="cursor-pointer font-medium">Needs attention ({warnings.length})</summary>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        {warnings.map((item) => <li key={item.externalId}><span className="font-mono text-xs">{item.externalId}</span>: {item.reason}</li>)}
      </ul>
    </details> : null}
    {skipped.length > 0 ? <details className="mt-3 rounded-xl border border-border bg-background px-3 py-3 text-sm leading-6 text-muted-foreground">
      <summary className="cursor-pointer font-medium">Skipped details ({skipped.length})</summary>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        {skipped.map((item) => <li key={item.externalId}><span className="font-mono text-xs">{item.externalId}</span>: {item.reason}</li>)}
      </ul>
    </details> : null}
  </section>;
}
