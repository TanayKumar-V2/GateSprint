"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MathText } from "@/components/markdown/math-text";
import { QuestionFigures } from "@/components/questions/question-figures";
import type { MockRunnerPayload } from "@/lib/mocks";
import type { PaletteStatus } from "@/lib/mocks-rules";
import { MockTimer } from "./mock-timer";
import { QuestionPalette } from "./question-palette";
import { VirtualCalculator } from "./virtual-calculator";
import { MockAnswer, type DraftAnswer } from "./mock-answer";

function toDraft(saved: unknown): DraftAnswer {
  if (!saved || typeof saved !== "object") return null;
  const s = saved as Record<string, unknown>;
  if (typeof s.optionId === "string") return { optionId: s.optionId };
  if (Array.isArray(s.optionIds)) return { optionIds: s.optionIds as string[] };
  if (typeof s.value === "number") return { value: s.value };
  return null;
}

function sameAnswer(a: DraftAnswer, b: DraftAnswer): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function MockRunner({ payload }: { payload: MockRunnerPayload }) {
  const router = useRouter();
  const { meta, items } = payload;
  const [pos, setPos] = useState(0);
  const [drafts, setDrafts] = useState<Record<string, DraftAnswer>>(() =>
    Object.fromEntries(items.map((i) => [i.itemId, toDraft(i.selectedAnswer)])),
  );
  const [natTexts, setNatTexts] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      items.map((i) => {
        const d = toDraft(i.selectedAnswer);
        return [i.itemId, d && "value" in d ? String(d.value) : ""];
      }),
    ),
  );
  const [saved, setSaved] = useState<Record<string, DraftAnswer>>(() =>
    Object.fromEntries(items.map((i) => [i.itemId, toDraft(i.selectedAnswer)])),
  );
  const [marked, setMarked] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(items.map((i) => [i.itemId, i.markedForReview])),
  );
  const [visited, setVisited] = useState<number[]>(() =>
    items
      .filter((i) => toDraft(i.selectedAnswer) !== null || i.markedForReview)
      .map((i) => i.position),
  );
  const [timeAcc, setTimeAcc] = useState<Record<string, number>>({});
  const [score, setScore] = useState(payload.currentScore);
  const [answeredCount, setAnsweredCount] = useState(payload.answeredCount);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const openedAt = useRef(Date.now());
  const finishingRef = useRef(false);
  const stateRef = useRef({ pos, drafts, natTexts, saved });
  stateRef.current = { pos, drafts, natTexts, saved };

  const current = items[pos]!;

  const markVisited = useCallback(
    (p: number) => {
      setVisited((prev) => {
        if (prev.includes(p)) return prev;
        const next = [...prev, p];
        try {
          localStorage.setItem(`mock-visited:${meta.sessionId}`, JSON.stringify(next));
        } catch {
          // Visit tracking is a nicety; the paper survives without it.
        }
        return next;
      });
    },
    [meta.sessionId],
  );

  useEffect(() => {
    markVisited(0);
    // Resume visits saved in this browser (server render has no storage).
    try {
      const raw = localStorage.getItem(`mock-visited:${meta.sessionId}`);
      if (raw) {
        const stored = JSON.parse(raw) as number[];
        if (Array.isArray(stored)) setVisited((prev) => [...new Set([...prev, ...stored])]);
      }
    } catch {
      // Visit tracking is a nicety; the paper survives without it.
    }
  }, [markVisited, meta.sessionId]);

  // Leaving mid-paper warns; a submitted paper navigates freely.
  useEffect(() => {
    const guard = (e: BeforeUnloadEvent) => {
      if (!finishingRef.current) e.preventDefault();
    };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, []);

  async function persist(itemId: string, answer: DraftAnswer, seconds: number): Promise<boolean> {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/mocks/${meta.sessionId}/answer`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ itemId, answer, timeTakenSeconds: seconds }),
      });
      const data = (await res.json()) as {
        saved?: boolean;
        answeredCount?: number;
        currentScore?: number;
        error?: { code?: string; message: string };
      };
      if (!res.ok) {
        if (data.error?.code === "expired") {
          finishingRef.current = true;
          router.refresh();
          return false;
        }
        setSaveError(data.error?.message ?? "Couldn't save. Try again.");
        return false;
      }
      setSaved((prev) => ({ ...prev, [itemId]: answer }));
      if (typeof data.answeredCount === "number") setAnsweredCount(data.answeredCount);
      if (typeof data.currentScore === "number") setScore(data.currentScore);
      return true;
    } catch {
      setSaveError("Network hiccup — answer kept locally. Save again.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  function elapsedFor(itemId: string): number {
    const acc = timeAcc[itemId] ?? 0;
    return acc + Math.max(0, Math.round((Date.now() - openedAt.current) / 1000));
  }

  function resetClock(itemId: string) {
    setTimeAcc((prev) => ({ ...prev, [itemId]: 0 }));
    openedAt.current = Date.now();
  }

  /** Save the current draft when it differs from what's stored. */
  async function saveCurrent(): Promise<boolean> {
    const item = items[stateRef.current.pos]!;
    const draft = stateRef.current.drafts[item.itemId] ?? null;
    if (sameAnswer(draft, stateRef.current.saved[item.itemId] ?? null)) return true;
    const seconds = elapsedFor(item.itemId);
    const ok = await persist(item.itemId, draft, seconds);
    if (ok) resetClock(item.itemId);
    return ok;
  }

  async function jump(next: number) {
    if (next === pos || next < 0 || next >= items.length) return;
    // Bank the current draft before leaving so palette jumps never lose work.
    await saveCurrent();
    setTimeAcc((prev) => ({ ...prev, [items[pos]!.itemId]: elapsedFor(items[pos]!.itemId) }));
    openedAt.current = Date.now();
    markVisited(next);
    setPos(next);
  }

  async function toggleMark() {
    const item = current;
    const next = !marked[item.itemId];
    setMarked((prev) => ({ ...prev, [item.itemId]: next }));
    try {
      await fetch(`/api/mocks/${meta.sessionId}/mark`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ itemId: item.itemId, marked: next }),
      });
    } catch {
      setMarked((prev) => ({ ...prev, [item.itemId]: !next }));
    }
  }

  async function doFinish() {
    if (finishingRef.current) return;
    finishingRef.current = true;
    setFinishing(true);
    setConfirming(false);
    await saveCurrent().catch(() => undefined);
    try {
      const res = await fetch(`/api/mocks/${meta.sessionId}/finish`, { method: "POST" });
      if (!res.ok && res.status !== 422) throw new Error(`HTTP ${res.status}`);
      try {
        localStorage.removeItem(`mock-visited:${meta.sessionId}`);
      } catch {
        // Best effort only.
      }
      router.refresh();
    } catch {
      finishingRef.current = false;
      setFinishing(false);
      setSaveError("Couldn't submit. Check connection and try again.");
    }
  }

  function buildDraftFromNat(itemId: string): DraftAnswer | "invalid" {
    const text = (natTexts[itemId] ?? "").trim();
    if (text === "") return null;
    const value = Number(text);
    return Number.isFinite(value) ? { value } : "invalid";
  }

  const q = current.question;
  const draft = drafts[current.itemId] ?? null;
  const palette = items.map((i) => {
    const hasAnswer = (saved[i.itemId] ?? null) !== null;
    const isMarked = marked[i.itemId] ?? false;
    const status: PaletteStatus = hasAnswer
      ? isMarked
        ? "answered_marked"
        : "answered"
      : isMarked
        ? "marked"
        : visited.includes(i.position)
          ? "unanswered"
          : "unvisited";
    return { position: i.position, status };
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="sticky top-16 z-30 flex flex-wrap items-center gap-x-5 gap-y-2 border border-(--crt-line) bg-(--crt-bg) px-4 py-3">
        <MockTimer endsAt={new Date(meta.endsAt).toISOString()} onExpire={doFinish} />
        <span className="crt-micro text-[11px] tabular-nums text-(--crt-dim)">
          ANSWERED <output className="text-(--crt-ink)">{answeredCount}/{items.length}</output>
        </span>
        <span className="crt-micro text-[11px] tabular-nums text-(--crt-dim)">
          MARKS <output className="text-(--crt-ink)">{score}</output>
          <span className="text-[9px]"> (SAVED ONLY — ANSWERS HIDDEN)</span>
        </span>
        <span className="ml-auto flex gap-2">
          {confirming ? (
            <>
              <button type="button" onClick={doFinish} disabled={finishing} className="crt-btn-red !px-4 !py-2 !text-[11px]">
                {finishing ? "SUBMITTING…" : "CONFIRM SUBMIT"}
              </button>
              <button type="button" onClick={() => setConfirming(false)} className="crt-btn-line !px-4 !py-2 !text-[11px]">
                KEEP SOLVING
              </button>
            </>
          ) : (
            <button type="button" onClick={() => setConfirming(true)} disabled={finishing} className="crt-btn-red !px-4 !py-2 !text-[11px]">
              SUBMIT PAPER &gt;&gt;&gt;
            </button>
          )}
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="flex min-w-0 flex-col gap-4">
          <article className="border border-(--crt-line) bg-(--crt-bg)">
            <div className="crt-micro flex flex-wrap items-center justify-between gap-2 border-b border-(--crt-line) px-4 py-2 text-[10px] text-(--crt-dim)">
              <span>
                Q{pos + 1}/{items.length} {"///"} {q.subject.name.toUpperCase()} {"///"} {q.topic.name.toUpperCase()}
              </span>
              <span>
                {q.marks}M{q.negativeMarks > 0 ? ` · −${q.negativeMarks} NEG` : ""}
              </span>
            </div>
            <div className="flex flex-col gap-4 px-4 py-5 sm:px-5">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="crt-tag crt-tag-solid">{q.type.toUpperCase()}</span>
                <span className="crt-tag">{q.difficulty}</span>
                <span className="crt-tag">{q.year}</span>
                <button
                  type="button"
                  onClick={toggleMark}
                  aria-pressed={marked[current.itemId] ?? false}
                  className={marked[current.itemId] ? "crt-btn-red !px-3 !py-1 !text-[10px]" : "crt-btn-line !px-3 !py-1 !text-[10px]"}
                >
                  {marked[current.itemId] ? "★ MARKED" : "☆ MARK FOR REVIEW"}
                </button>
              </div>
              <h1 className="prose-study min-w-0 text-lg font-medium leading-8 break-words text-(--crt-ink)">
                <MathText text={q.prompt} inline />
              </h1>
              <QuestionFigures questionId={q.id} images={q.images} />
              <MockAnswer
                key={current.itemId}
                type={q.type}
                options={q.options}
                draft={draft}
                natText={natTexts[current.itemId] ?? ""}
                saving={saving}
                saveError={saveError}
                onDraftChange={(a) => {
                  setSaveError(null);
                  setDrafts((prev) => ({ ...prev, [current.itemId]: a }));
                }}
                onNatChange={(t) => {
                  setSaveError(null);
                  setNatTexts((prev) => ({ ...prev, [current.itemId]: t }));
                }}
                onSave={async () => {
                  if (q.type === "nat") {
                    const built = buildDraftFromNat(current.itemId);
                    if (built === "invalid") {
                      setSaveError("Enter a valid number.");
                      return;
                    }
                    // setState is async: mirror into the ref so saveCurrent
                    // sees the just-typed value on this tick.
                    stateRef.current.drafts[current.itemId] = built;
                    setDrafts((prev) => ({ ...prev, [current.itemId]: built }));
                  }
                  await saveCurrent();
                }}
                onClear={async () => {
                  stateRef.current.drafts[current.itemId] = null;
                  setDrafts((prev) => ({ ...prev, [current.itemId]: null }));
                  setNatTexts((prev) => ({ ...prev, [current.itemId]: "" }));
                  const seconds = elapsedFor(current.itemId);
                  const ok = await persist(current.itemId, null, seconds);
                  if (ok) resetClock(current.itemId);
                }}
              />
            </div>
          </article>

          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => jump(pos - 1)}
              disabled={pos === 0 || saving}
              className="crt-btn-line !px-4 !py-2 !text-[11px] disabled:opacity-40"
            >
              ← PREV
            </button>
            <button
              type="button"
              onClick={() => jump(pos + 1)}
              disabled={pos === items.length - 1 || saving}
              className="crt-btn-line !px-4 !py-2 !text-[11px] disabled:opacity-40"
            >
              NEXT →
            </button>
          </div>
        </div>

        <aside className="flex flex-col gap-4">
          <QuestionPalette items={palette} current={pos} onJump={jump} />
          <VirtualCalculator />
          <p className="crt-micro border border-(--crt-line) p-3 text-[10px] leading-relaxed text-(--crt-dim)">
            ANSWERS SAVE PER QUESTION. LEAVING SAVES THE DRAFT. THE CLOCK IS SERVER-OWNED — RELOADS DON'T PAUSE IT.
          </p>
        </aside>
      </div>
    </div>
  );
}
