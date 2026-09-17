export type ActivityDay = {
  date: string;
  attempts: number;
  correct: number;
};

export function buildActivity(
  attempts: { submittedAt: Date; isCorrect: boolean }[],
  now = new Date(),
): ActivityDay[] {
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const days = Array.from({ length: 30 }, (_, index) => {
    const date = new Date(today);
    date.setUTCDate(date.getUTCDate() - 29 + index);
    return { date: date.toISOString().slice(0, 10), attempts: 0, correct: 0 };
  });
  const byDate = new Map(days.map((day) => [day.date, day]));
  for (const attempt of attempts) {
    if (!Number.isFinite(attempt.submittedAt.getTime()) || attempt.submittedAt > now) continue;
    const day = byDate.get(attempt.submittedAt.toISOString().slice(0, 10));
    if (!day) continue;
    day.attempts++;
    if (attempt.isCorrect) day.correct++;
  }
  return days;
}
