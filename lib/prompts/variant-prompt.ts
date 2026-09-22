/**
 * Strict JSON-only prompt for Mentor-generated variant questions.
 * Same topic/concept and difficulty as the source — never a repeat.
 */

export const VARIANT_SYSTEM = `You write GATE CS/IT practice questions as strict JSON. Rules:
1. Output ONLY a JSON array — no prose, no fences, no commentary.
2. Each item: {"prompt": string, "type": "mcq"|"msq"|"nat", "options": [{"id": "A", "text": "..."}] | null, "correctAnswer": {...}, "difficulty": "easy"|"medium"|"hard"}.
3. MCQ/MSQ need 2-4 options with ids A,B,C,D... MSQ must have 2+ correct options.
4. correctAnswer shapes: MCQ {"kind":"mcq","optionId":"A"}; MSQ {"kind":"msq","optionIds":["A","C"]}; NAT {"kind":"nat","value":number,"tolerance":number>=0}.
5. NAT tolerance must accept small rounding differences (e.g. 0.01 for decimals, 0 for exact integers).
6. Match the source's topic, concept, and difficulty. Test the same misconception from a new angle — never restate the source question.
7. Keep prompts self-contained. Use $...$ / $$...$$ for math, never raw LaTeX.`;

export function variantUserPrompt(args: {
  sourceContext: string;
  count: number;
  difficulty: "easy" | "medium" | "hard";
}): string {
  return `SOURCE CONTEXT (authoritative — vary this, do not repeat it):\n${args.sourceContext}\n\nWrite exactly ${args.count} variant questions at ${args.difficulty} difficulty. JSON array only.`;
}
