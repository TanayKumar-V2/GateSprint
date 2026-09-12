"use client";

import { useMemo, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Option = { id: string; text: string };
type AdminQuestion = { id: string; year: number; questionNumber: number | null; type: "mcq" | "msq" | "nat"; difficulty: "easy" | "medium" | "hard"; prompt: string; options: Option[] | null; correctAnswer: unknown; marks: number; negativeMarks: number; sourceLabel: string | null; extractionConfidence: number | null; isPublished: boolean; subjectId: string; subjectName: string; topicId: string; topicName: string; solution: string | null };
type Subject = { id: string; name: string; slug: string };
type Topic = { id: string; name: string; slug: string; subjectId: string };

const blank = { subjectId: "", topicId: "", year: String(new Date().getFullYear()), questionNumber: "", type: "mcq" as "mcq" | "msq" | "nat", difficulty: "medium" as "easy" | "medium" | "hard", prompt: "", options: [{ id: "A", text: "" }, { id: "B", text: "" }, { id: "C", text: "" }, { id: "D", text: "" }] as Option[], correct: "A", natValue: "", tolerance: "0", marks: "1", negativeMarks: "0.33", sourceLabel: "", solution: "", isPublished: false };

export function AdminQuestionManager({ initialQuestions, subjects, topics }: { initialQuestions: AdminQuestion[]; subjects: Subject[]; topics: Topic[] }) {
  const [items, setItems] = useState(initialQuestions);
  const [form, setForm] = useState(blank);
  const [editing, setEditing] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const availableTopics = useMemo(() => topics.filter((topic) => topic.subjectId === form.subjectId), [topics, form.subjectId]);
  const set = (key: keyof typeof blank, value: string | boolean) => setForm((current) => ({ ...current, [key]: value }));
  const reset = () => { setForm(blank); setEditing(null); setNotice(null); };

  function edit(item: AdminQuestion) {
    const answer = item.correctAnswer as { kind?: string; optionId?: string; optionIds?: string[]; value?: number; tolerance?: number };
    setEditing(item.id); setForm({ ...blank, subjectId: item.subjectId, topicId: item.topicId, year: String(item.year), questionNumber: item.questionNumber ? String(item.questionNumber) : "", type: item.type, difficulty: item.difficulty, prompt: item.prompt, options: item.options ?? blank.options, correct: answer.optionId ?? answer.optionIds?.join(",") ?? "A", natValue: answer.value === undefined ? "" : String(answer.value), tolerance: answer.tolerance === undefined ? "0" : String(answer.tolerance), marks: String(item.marks), negativeMarks: String(item.negativeMarks), sourceLabel: item.sourceLabel ?? "", solution: item.solution ?? "", isPublished: item.isPublished });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function save(event: FormEvent) {
    event.preventDefault(); setNotice(null);
    const options = form.type === "nat" ? null : form.options.filter((option) => option.text.trim());
    const correctAnswer = form.type === "mcq" ? { kind: "mcq", optionId: form.correct } : form.type === "msq" ? { kind: "msq", optionIds: form.correct.split(",").map((value) => value.trim()).filter(Boolean) } : { kind: "nat", value: Number(form.natValue), tolerance: Number(form.tolerance) };
    const body = { subjectId: form.subjectId, topicId: form.topicId, year: Number(form.year), questionNumber: form.questionNumber ? Number(form.questionNumber) : null, type: form.type, difficulty: form.difficulty, prompt: form.prompt, options, correctAnswer, marks: Number(form.marks), negativeMarks: Number(form.negativeMarks), sourceLabel: form.sourceLabel || null, solution: form.solution, isPublished: form.isPublished };
    const response = await fetch(editing ? `/api/admin/questions/${editing}` : "/api/admin/questions", { method: editing ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!response.ok) { const data = await response.json().catch(() => null) as { error?: { message?: string } } | null; setNotice(data?.error?.message ?? "Could not save the question."); return; }
    const refreshed = await fetch("/api/admin/questions", { cache: "no-store" }); const data = await refreshed.json() as { questions: AdminQuestion[] }; setItems(data.questions); setNotice(editing ? "Question updated." : "Question added."); setForm(blank); setEditing(null);
  }

  async function remove(id: string) { if (!window.confirm("Delete this question and its solution?")) return; const response = await fetch(`/api/admin/questions/${id}`, { method: "DELETE" }); if (response.ok) setItems((current) => current.filter((item) => item.id !== id)); }

  return <div className="grid gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
    <form onSubmit={save} className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
      <div className="mb-5 flex items-center justify-between"><h2 className="text-xl font-semibold">{editing ? "Edit question" : "Add question"}</h2>{editing ? <Button type="button" variant="ghost" onClick={reset}>Cancel</Button> : null}</div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-2 text-sm font-medium">Subject<select value={form.subjectId} onChange={(e) => setForm((current) => ({ ...current, subjectId: e.target.value, topicId: "" }))} className="h-10 rounded-lg border border-input bg-background px-3"><option value="">Select subject</option>{subjects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label className="grid gap-2 text-sm font-medium">Topic<select value={form.topicId} onChange={(e) => set("topicId", e.target.value)} className="h-10 rounded-lg border border-input bg-background px-3"><option value="">Select topic</option>{availableTopics.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label className="grid gap-2 text-sm font-medium">Year<Input value={form.year} onChange={(e) => set("year", e.target.value)} type="number" /></label><label className="grid gap-2 text-sm font-medium">Question number<Input value={form.questionNumber} onChange={(e) => set("questionNumber", e.target.value)} type="number" /></label>
        <label className="grid gap-2 text-sm font-medium">Type<select value={form.type} onChange={(e) => set("type", e.target.value)} className="h-10 rounded-lg border border-input bg-background px-3"><option value="mcq">MCQ</option><option value="msq">MSQ</option><option value="nat">NAT</option></select></label><label className="grid gap-2 text-sm font-medium">Difficulty<select value={form.difficulty} onChange={(e) => set("difficulty", e.target.value)} className="h-10 rounded-lg border border-input bg-background px-3"><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></select></label>
      </div>
      <label className="mt-4 grid gap-2 text-sm font-medium">Question prompt<textarea required value={form.prompt} onChange={(e) => set("prompt", e.target.value)} rows={5} className="rounded-lg border border-input bg-background px-3 py-2 font-mono text-sm" placeholder="Use $...$ for inline math." /></label>
      {form.type !== "nat" ? <div className="mt-4 grid gap-2"><span className="text-sm font-medium">Options</span>{form.options.map((option, index) => <div key={option.id} className="flex gap-2"><span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-sm font-semibold">{option.id}</span><Input value={option.text} onChange={(e) => setForm((current) => ({ ...current, options: current.options.map((item, itemIndex) => itemIndex === index ? { ...item, text: e.target.value } : item) }))} placeholder={`Option ${option.id}`} /></div>)}</div> : null}
      <div className="mt-4 grid gap-4 sm:grid-cols-2"><label className="grid gap-2 text-sm font-medium">Correct answer<Input value={form.type === "nat" ? form.natValue : form.correct} onChange={(e) => set(form.type === "nat" ? "natValue" : "correct", e.target.value)} placeholder={form.type === "msq" ? "A,C" : form.type === "nat" ? "42" : "A"} /></label><label className="grid gap-2 text-sm font-medium">Tolerance (NAT)<Input value={form.tolerance} onChange={(e) => set("tolerance", e.target.value)} type="number" step="any" /></label><label className="grid gap-2 text-sm font-medium">Marks<Input value={form.marks} onChange={(e) => set("marks", e.target.value)} type="number" step="any" /></label><label className="grid gap-2 text-sm font-medium">Negative marks<Input value={form.negativeMarks} onChange={(e) => set("negativeMarks", e.target.value)} type="number" step="any" /></label></div>
      <label className="mt-4 grid gap-2 text-sm font-medium">Source label<Input value={form.sourceLabel} onChange={(e) => set("sourceLabel", e.target.value)} placeholder="GATE 2024" /></label><label className="mt-4 grid gap-2 text-sm font-medium">Solution<textarea required value={form.solution} onChange={(e) => set("solution", e.target.value)} rows={7} className="rounded-lg border border-input bg-background px-3 py-2 font-mono text-sm" placeholder="Explain the reasoning. Use Markdown and LaTeX." /></label>
      <label className="mt-4 flex items-center gap-2 text-sm"><input type="checkbox" checked={form.isPublished} onChange={(e) => set("isPublished", e.target.checked)} /> Publish for students</label>
      {notice ? <p className="mt-4 text-sm text-primary">{notice}</p> : null}<Button type="submit" className="mt-5 w-full">{editing ? "Save changes" : "Add question"}</Button>
    </form>
    <section><div className="mb-4 flex items-end justify-between"><div><h2 className="text-xl font-semibold">Manage questions</h2><p className="mt-1 text-sm text-muted-foreground">{items.length} questions in the bank</p></div></div><div className="grid gap-3">{items.map((item) => <article key={item.id} className="rounded-xl border border-border bg-card p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap gap-2 text-xs text-muted-foreground"><span>{item.subjectName}</span><span>/</span><span>{item.topicName}</span><span>/</span><span>{item.year}</span><span>/</span><span>{item.type.toUpperCase()}</span></div><h3 className="mt-2 font-medium">{item.prompt.slice(0, 180)}{item.prompt.length > 180 ? "..." : ""}</h3></div><span className={`rounded-full px-2 py-1 text-xs font-medium ${item.isPublished ? "bg-primary/20 text-foreground" : "bg-muted text-muted-foreground"}`}>{item.isPublished ? "Published" : "Draft"}</span>{item.extractionConfidence !== null && item.extractionConfidence < 0.6 ? <span className="rounded-full bg-destructive/15 px-2 py-1 text-xs font-medium text-destructive">Low confidence — verify answer</span> : null}</div><div className="mt-4 flex gap-2"><Button type="button" size="sm" variant="outline" onClick={() => edit(item)}>Edit</Button><Button type="button" size="sm" variant="destructive" onClick={() => void remove(item.id)}>Delete</Button></div></article>)}</div></section>
  </div>;
}
