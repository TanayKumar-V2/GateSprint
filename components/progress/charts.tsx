"use client";

import { useMemo, useState } from "react";
import { useReducedMotion } from "motion/react";
import { AreaChart } from "@/components/charts/area-chart";
import { Area } from "@/components/charts/area";
import { BarChart } from "@/components/charts/bar-chart";
import { Bar } from "@/components/charts/bar";
import { BarXAxis } from "@/components/charts/bar-x-axis";
import { Grid } from "@/components/charts/grid";
import { XAxis } from "@/components/charts/x-axis";
import { ChartTooltip } from "@/components/charts/tooltip/chart-tooltip";
import { TooltipContent } from "@/components/charts/tooltip/tooltip-content";
import type { ActivityDay } from "@/lib/progress-activity";
import type { SubjectStats } from "@/lib/progress";

const saffron = "var(--brand-saffron)";
const green = "var(--brand-success)";
const red = "var(--brand-danger)";
const shortNames: Record<string, string> = {
  "general-aptitude": "Aptitude", "engineering-mathematics": "Eng. Math", "discrete-mathematics": "Discrete",
  "computer-organization": "COA", "programming-data-structures": "DS & C", "computer-networks": "Networks",
  "theory-of-computation": "TOC", "operating-systems": "OS", "compiler-design": "Compilers", "digital-logic": "Logic",
};

export function ProgressCharts({ activity, subjects }: { activity: ActivityDay[]; subjects: SubjectStats[] }) {
  const [days, setDays] = useState(30);
  const reducedMotion = useReducedMotion();
  const selected = useMemo(() => activity.slice(-days), [activity, days]);
  const data = useMemo(() => selected.map((day) => ({ ...day, date: new Date(`${day.date}T12:00:00Z`) })), [selected]);
  const subjectData = subjects.filter((s) => s.attempts > 0).map((s) => ({
    name: shortNames[s.slug] ?? s.name, fullName: s.name, correct: s.correct, incorrect: s.attempts - s.correct,
  }));
  const total = selected.reduce((sum, day) => sum + day.attempts, 0);
  const active = selected.filter((day) => day.attempts > 0).length;

  return (
    <div className="progress-charts grid min-w-0 gap-6">
      <section aria-labelledby="activity-heading" className="min-w-0 border border-(--crt-line) bg-(--crt-bg) p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="crt-micro text-[10px] text-(--crt-red)">[ ACTIVITY FEED {"///"} DAILY TOTALS · UTC ]</p>
            <h2 id="activity-heading" className="crt-macro mt-2 text-[clamp(1.5rem,4vw,2.4rem)] text-(--crt-ink)">PRACTICE RHYTHM</h2>
            <p className="crt-micro mt-2 text-[11px] text-(--crt-dim)">{total} ATTEMPTS ACROSS {active} ACTIVE {active === 1 ? "DAY" : "DAYS"}. EVERY SESSION COUNTS.</p>
          </div>
          <div className="flex gap-px border border-(--crt-line) bg-(--crt-line)" role="group" aria-label="Activity period">
            {[7, 30].map((period) => (
              <button key={period} type="button" aria-pressed={days === period} onClick={() => setDays(period)} className={`crt-micro px-4 py-2.5 text-[11px] transition-colors ${days === period ? "bg-(--crt-red) font-bold text-(--crt-bg)" : "bg-(--crt-bg) text-(--crt-dim) hover:text-(--crt-ink)"}`}>{period} DAYS</button>
            ))}
          </div>
        </div>
        <div className="crt-micro mt-5 flex flex-wrap gap-5 text-[10px] text-(--crt-dim)">
          <span className="flex items-center gap-2"><span className="inline-block size-2 bg-brand-saffron" />ALL ATTEMPTS</span>
          <span className="flex items-center gap-2"><span className="inline-block size-2 bg-brand-success" />CORRECT</span>
        </div>
        {total > 0 ? (
          <div role="img" aria-label={`Daily activity over ${days} days: ${total} attempts. Exact values are available in the table below.`}>
            <AreaChart data={data} className="mt-2 h-64 sm:h-80" style={{ aspectRatio: "auto" }} margin={{ top: 25, right: 18, bottom: 36, left: 18 }} animationDuration={reducedMotion ? 0 : 650} yDomainTween={!reducedMotion}>
              <Grid horizontal numTicksRows={4} strokeDasharray="3,5" />
              <Area dataKey="attempts" fill={saffron} fillOpacity={0.2} strokeWidth={2} animate={!reducedMotion} />
              <Area dataKey="correct" fill={green} fillOpacity={0.08} strokeWidth={2} animate={!reducedMotion} />
              <XAxis numTicks={4} />
              <ChartTooltip damping={reducedMotion ? 0 : 20} rows={(point) => [{ label: "Attempts", value: Number(point.attempts), color: saffron }, { label: "Correct", value: Number(point.correct), color: green }]} />
            </AreaChart>
          </div>
        ) : <p className="crt-micro grid min-h-52 place-items-center px-4 text-center text-[11px] leading-relaxed text-(--crt-dim)">NO ATTEMPTS IN THESE {days} DAYS. A NEW SESSION WILL APPEAR HERE.</p>}
        <details className="crt-micro border-t border-(--crt-line) pt-3 text-[11px]">
          <summary className="w-fit cursor-pointer text-(--crt-dim) hover:text-(--crt-red)">VIEW DAILY NUMBERS [+]</summary>
          <div className="mt-3 max-h-64 overflow-auto">
            <table className="w-full text-left tabular-nums"><caption className="sr-only">Daily practice activity in UTC</caption><thead><tr className="text-(--crt-dim)"><th className="py-2 font-normal">DATE</th><th className="font-normal">ATTEMPTS</th><th className="font-normal">CORRECT</th></tr></thead><tbody className="text-(--crt-ink)">{selected.map((day) => <tr key={day.date} className="border-t border-(--crt-line)"><td className="py-2">{day.date}</td><td>{day.attempts}</td><td>{day.correct}</td></tr>)}</tbody></table>
          </div>
        </details>
      </section>
      {subjectData.length > 0 ? (
        <section aria-labelledby="subject-chart-heading" className="min-w-0 border border-(--crt-line) bg-(--crt-bg) p-5 sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div><p className="crt-micro text-[10px] text-(--crt-red)">[ EFFORT MAP {"///"} ALL TIME ]</p><h2 id="subject-chart-heading" className="crt-macro mt-2 text-[clamp(1.5rem,4vw,2.4rem)] text-(--crt-ink)">WHERE EFFORT GOES</h2><p className="crt-micro mt-2 text-[11px] text-(--crt-dim)">CORRECT VS INCORRECT BY SUBJECT</p></div>
            <div className="crt-micro flex gap-4 text-[10px] text-(--crt-dim)"><span className="flex items-center gap-2"><span className="inline-block size-2 bg-brand-success" />CORRECT</span><span className="flex items-center gap-2"><span className="inline-block size-2 bg-brand-danger" />INCORRECT</span></div>
          </div>
          <div className="mt-5 overflow-x-auto" role="img" aria-label="Stacked bars compare correct and incorrect attempts for each attempted subject. Exact totals are listed below.">
            <div style={{ minWidth: Math.max(280, subjectData.length * 76) }}>
              <BarChart data={subjectData} xDataKey="name" stacked className="h-64 [aspect-ratio:auto] sm:h-72" margin={{ top: 20, right: 16, bottom: 38, left: 16 }} animationDuration={reducedMotion ? 0 : 650} barGap={0.55}>
                <Grid horizontal numTicksRows={4} strokeDasharray="3,5" />
                <Bar dataKey="correct" fill={green} animate={!reducedMotion} lineCap={4} />
                <Bar dataKey="incorrect" fill={red} animate={!reducedMotion} lineCap={4} />
                <BarXAxis showAllLabels />
                <ChartTooltip showDatePill={false} damping={reducedMotion ? 0 : 20} content={({ point }) => <TooltipContent title={String(point.fullName)} rows={[{ label: "Correct", value: Number(point.correct), color: green }, { label: "Incorrect", value: Number(point.incorrect), color: red }]} />} />
              </BarChart>
            </div>
          </div>
          <ul className="crt-micro mt-2 grid gap-x-6 gap-y-2 border-t border-(--crt-line) pt-4 text-[11px] sm:grid-cols-2">{subjectData.map((s) => <li key={s.fullName} className="flex justify-between gap-3"><span className="text-(--crt-dim)">{s.fullName.toUpperCase()}</span><span className="shrink-0 tabular-nums text-(--crt-ink)">{s.correct} / {s.correct + s.incorrect} CORRECT</span></li>)}</ul>
        </section>
      ) : null}
    </div>
  );
}
