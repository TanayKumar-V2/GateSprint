/* Repro of the Q29 grade failure: raw model output vs parser. Temp file. */
import "dotenv/config";
import { buildGradePrompt, GRADE_SYSTEM, parseAiGrade } from "./lib/ai/grade-validation";

import { readFile, writeFile } from "node:fs/promises";

const data = JSON.parse(
  await readFile(String.raw`C:\Users\RANAPR~1\AppData\Local\Temp\opencode\gate-2023-fixed.json`, "utf-8"),
);
const q = (data.questions as unknown[]).find(
  (x) => (x as { questionNumber: number }).questionNumber === 29,
) as { prompt: string; options: { id: string; text: string }[] | null };

const body = {
  model: process.env.GROQ_PRIMARY_MODEL ?? "openai/gpt-oss-20b",
  messages: [
    { role: "system", content: GRADE_SYSTEM },
    { role: "user", content: buildGradePrompt({ type: "mcq", prompt: q.prompt, options: q.options, figureCount: 0 }) },
  ],
  max_tokens: 2400,
  temperature: 0,
};
const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
  method: "POST",
  headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}`, "Content-Type": "application/json" },
  body: JSON.stringify(body),
});
const payload = (await res.json()) as {
  choices?: { message?: { content?: string }; finish_reason?: string }[];
  error?: unknown;
};
const text = payload.choices?.[0]?.message?.content ?? "";
console.log("finish:", payload.choices?.[0]?.finish_reason, "len:", text.length);
await writeFile(String.raw`C:\Users\RANAPR~1\AppData\Local\Temp\opencode\q29grade.txt`, text, "utf-8");
const parsed = parseAiGrade(text, "mcq", q.options);
console.log("parsed:", parsed === null ? "NULL (rejected)" : `verdict=${parsed.verdict}`);
