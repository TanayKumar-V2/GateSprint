import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { renderToString } from "react-dom/server";
import { QuestionSolver } from "../components/practice/solver";
import type { QuestionView } from "../lib/questions";

const baseView: QuestionView = {
  id: "q1",
  year: 2025,
  questionNumber: 3,
  type: "mcq",
  difficulty: "medium",
  prompt: "The average marks were 30.8. After correction the average becomes 31.4. How many students?",
  options: [
    { id: "A", text: "25" },
    { id: "B", text: "28" },
    { id: "C", text: "30" },
    { id: "D", text: "32" },
  ],
  marks: 1,
  negativeMarks: 0,
  sourceLabel: "GATE 2025",
  subject: { slug: "general-aptitude", name: "General Aptitude" },
  topic: { slug: "numerical-ability", name: "Numerical Ability" },
  reveal: true,
  correctAnswer: { kind: "mcq", optionId: "C" },
  solution: "The shift is $42-24=18$, and $31.4n-30.8n=0.6n$. $$0.6n=18 \\Rightarrow n=30$$",
  lastAttempt: {
    selectedAnswer: { optionId: "C" },
    isCorrect: true,
    submittedAt: new Date("2026-09-17T10:00:00Z"),
  },
  bookmarked: false,
  images: [],
};

describe("QuestionSolver render", () => {
  it("shows the verdict and the brief solution with rendered math after submit", () => {
    const html = renderToString(<QuestionSolver view={baseView} />);
    assert.match(html, /TARGET HIT/);
    assert.match(html, /SOLUTION/);
    assert.match(html, /katex/);
    assert.match(html, /0\.6n=18/);
  });

  it("shows no solution block when no solution exists", () => {
    const html = renderToString(
      <QuestionSolver view={{ ...baseView, solution: null }} />,
    );
    assert.match(html, /TARGET HIT/);
    assert.doesNotMatch(html, /SOLUTION/);
    assert.doesNotMatch(html, /katex/);
  });

  it("renders image-only options as FIGURE tags, never the raw marker", () => {
    const html = renderToString(
      <QuestionSolver
        view={{
          ...baseView,
          options: [
            { id: "A", text: "[See figure]" },
            { id: "B", text: "[See figure]" },
          ],
        }}
      />,
    );
    assert.match(html, /FIGURE/);
    assert.doesNotMatch(html, /\[See figure\]/);
  });

  it("flags lost option diagrams and unmapped ones differently", () => {
    const view = {
      ...baseView,
      options: [
        { id: "A", text: "[See figure]" },
        { id: "B", text: "[See figure]" },
      ],
    };
    const missing = renderToString(
      <QuestionSolver view={view} figureNotice="missing" />,
    );
    assert.match(missing, /DIAGRAMS MISSING/);
    const below = renderToString(
      <QuestionSolver view={view} figureNotice="below" />,
    );
    assert.match(below, /OPTION DIAGRAMS/);
    assert.doesNotMatch(below, /DIAGRAMS MISSING/);
    const clean = renderToString(<QuestionSolver view={baseView} />);
    assert.doesNotMatch(clean, /DIAGRAMS/);
  });
});
