import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { questions, subjects, topics } from "@/db/schema";
import { cached } from "./api/cache";
import {
  missingYears,
  shareOf,
  topicTrend,
  zeroFillYears,
  type TrendLabel,
} from "./trends-rules";

export type YearBucket = { year: number; marks: number; count: number };

export type SubjectWeight = {
  slug: string;
  name: string;
  totalMarks: number;
  share: number;
  byYear: YearBucket[];
  topTopics: { slug: string; name: string; totalMarks: number; trend: TrendLabel; practicePath: string }[];
};

export type TopicWeight = {
  slug: string;
  name: string;
  subjectSlug: string;
  subjectName: string;
  totalMarks: number;
  byYear: YearBucket[];
  trend: TrendLabel;
  slope: number;
  practicePath: string;
};

const WEIGHT_TTL_MS = 60 * 60 * 1000;

function yearRange(fromYear: number): { from: number; to: number } {
  const to = new Date().getUTCFullYear();
  return { from: Math.min(fromYear, to), to };
}

export async function getWeightage(opts: { fromYear?: number; subject?: string } = {}): Promise<{
  subjects: SubjectWeight[];
  topics: TopicWeight[];
  meta: { fromYear: number; toYear: number; grandTotalMarks: number; missingYears: number[]; note: string };
}> {
  const { from, to } = yearRange(opts.fromYear ?? new Date().getUTCFullYear() - 10);
  return cached(`weightage:${from}:${opts.subject ?? "all"}`, WEIGHT_TTL_MS, async () => {
    const subjectRows = await db.select().from(subjects).orderBy(subjects.displayOrder);
    const topicRows = await db.select().from(topics);
    const questionRows = await db
      .select({
        subjectId: questions.subjectId,
        topicId: questions.topicId,
        year: questions.year,
        marks: questions.marks,
      })
      .from(questions)
      .where(eq(questions.isPublished, true));

    const inScopeSubjects = opts.subject
      ? subjectRows.filter((s) => s.slug === opts.subject)
      : subjectRows;
    const inScopeIds = new Set(inScopeSubjects.map((s) => s.id));
    const scoped = questionRows.filter((q) => inScopeIds.has(q.subjectId));

    const bySubjectYear = new Map<string, Map<number, { marks: number; count: number }>>();
    const byTopicYear = new Map<string, Map<number, { marks: number; count: number }>>();
    for (const q of scoped) {
      const sm = bySubjectYear.get(q.subjectId) ?? new Map();
      const se = sm.get(q.year) ?? { marks: 0, count: 0 };
      se.marks += q.marks;
      se.count += 1;
      sm.set(q.year, se);
      bySubjectYear.set(q.subjectId, sm);
      const tm = byTopicYear.get(q.topicId) ?? new Map();
      const te = tm.get(q.year) ?? { marks: 0, count: 0 };
      te.marks += q.marks;
      te.count += 1;
      tm.set(q.year, te);
      byTopicYear.set(q.topicId, tm);
    }

    const round2 = (n: number) => Math.round(n * 100) / 100;
    const topicById = new Map(topicRows.map((t) => [t.id, t]));
    const subjectById = new Map(subjectRows.map((s) => [s.id, s]));

    const topicWeights: TopicWeight[] = [];
    for (const [topicId, years] of byTopicYear) {
      const t = topicById.get(topicId);
      const s = t ? subjectById.get(t.subjectId) : undefined;
      if (!t || !s) continue;
      const filled = zeroFillYears(
        [...years.entries()].map(([year, v]) => ({ year, marks: round2(v.marks), count: v.count })),
        from,
        to,
      );
      const { slope, label } = topicTrend(filled);
      topicWeights.push({
        slug: t.slug,
        name: t.name,
        subjectSlug: s.slug,
        subjectName: s.name,
        totalMarks: round2(filled.reduce((n, y) => n + y.marks, 0)),
        byYear: filled,
        trend: label,
        slope,
        practicePath: `/practice?subject=${s.slug}&topic=${t.slug}`,
      });
    }
    topicWeights.sort((a, b) => b.totalMarks - a.totalMarks);

    const grandTotal = round2(topicWeights.reduce((n, t) => n + t.totalMarks, 0));
    const subjectsOut: SubjectWeight[] = inScopeSubjects.map((s) => {
      const years = bySubjectYear.get(s.id) ?? new Map();
      const filled = zeroFillYears(
        [...years.entries()].map(([year, v]) => ({ year, marks: round2(v.marks), count: v.count })),
        from,
        to,
      );
      const total = round2(filled.reduce((n, y) => n + y.marks, 0));
      return {
        slug: s.slug,
        name: s.name,
        totalMarks: total,
        share: shareOf(total, grandTotal),
        byYear: filled,
        topTopics: topicWeights
          .filter((t) => t.subjectSlug === s.slug)
          .slice(0, 3)
          .map((t) => ({ slug: t.slug, name: t.name, totalMarks: t.totalMarks, trend: t.trend, practicePath: t.practicePath })),
      };
    });
    subjectsOut.sort((a, b) => b.totalMarks - a.totalMarks);

    const missing = missingYears(
      (() => {
        const perYear = new Map<number, number>();
        for (const q of scoped) perYear.set(q.year, (perYear.get(q.year) ?? 0) + 1);
        return [...perYear.entries()].map(([year, count]) => ({ year, count }));
      })(),
      from,
      to,
    );
    return {
      subjects: subjectsOut,
      topics: topicWeights,
      meta: {
        fromYear: from,
        toYear: to,
        grandTotalMarks: grandTotal,
        missingYears: missing,
        note:
          missing.length > 0
            ? `Bank covers ${to - from + 1 - missing.length}/${to - from + 1} years — gaps: ${missing.join(", ")}. Derived from bank coverage, not the official GATE key.`
            : "Derived from bank coverage, not the official GATE key.",
      },
    };
  });
}
