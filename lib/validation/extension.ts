import { z } from "zod";
import { submittedAnswerSchema } from "./answers";

const slug = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9-]+$/);

export const mistakeTagSchema = z.enum([
  "concept_gap",
  "silly_mistake",
  "trap",
  "time_pressure",
  "unattempted",
]);

export type MistakeTag = z.infer<typeof mistakeTagSchema>;

export const mistakeListQuerySchema = z.object({
  tag: mistakeTagSchema.optional(),
  subject: slug.optional(),
  topic: slug.optional(),
  resolved: z.enum(["true", "false"]).transform((v) => v === "true").optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export type MistakeListQuery = z.infer<typeof mistakeListQuerySchema>;

export const mistakePatchSchema = z
  .object({
    tag: mistakeTagSchema.nullable().optional(),
    resolved: z.boolean().optional(),
  })
  .refine((v) => v.tag !== undefined || v.resolved !== undefined, {
    message: "Provide tag and/or resolved.",
  });

export type MistakePatch = z.infer<typeof mistakePatchSchema>;

export const questionIdParamSchema = z.object({
  questionId: z.string().uuid(),
});

export const revisionQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export type RevisionQuery = z.infer<typeof revisionQuerySchema>;

export const revisionCompleteSchema = z.object({
  questionId: z.string().uuid(),
});

export const timeQuerySchema = z.object({
  subject: slug.optional(),
});

export type TimeQuery = z.infer<typeof timeQuerySchema>;

export const topicOverrideSchema = z.enum(["skipped", "focus"]);

export const syllabusTopicPatchSchema = z.object({
  topicSlug: slug,
  subjectSlug: slug.optional(),
  override: topicOverrideSchema.nullable(),
});

export type SyllabusTopicPatch = z.infer<typeof syllabusTopicPatchSchema>;

/* ---------- Mocks + test builder ---------- */

export const mockTypeSchema = z.enum(["full", "sectional", "pyq_year"]);

const slugList = z
  .array(slug)
  .max(20)
  .optional();

export const mockCreateSchema = z.object({
  type: mockTypeSchema,
  subjectSlugs: slugList,
  topicSlugs: slugList,
  year: z.number().int().min(1990).max(2100).optional(),
  totalQuestions: z.number().int().min(5).max(65).optional(),
  durationSeconds: z.number().int().min(300).max(10800).optional(),
});

export type MockCreate = z.infer<typeof mockCreateSchema>;

export const mockAnswerSchema = z.object({
  itemId: z.string().uuid(),
  // null clears a saved answer (GATE lets you un-answer before submit).
  answer: submittedAnswerSchema.nullable(),
  timeTakenSeconds: z.number().int().min(0).max(10800).optional(),
});

export type MockAnswer = z.infer<typeof mockAnswerSchema>;

export const mockMarkSchema = z.object({
  itemId: z.string().uuid(),
  marked: z.boolean(),
});

export const mockListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(25).default(10),
});

const commaSlugs = z
  .string()
  .trim()
  .max(800)
  .transform((v, ctx) => {
    const parts = v.split(",").map((s) => s.trim()).filter(Boolean);
    for (const p of parts) {
      if (!/^[a-z0-9-]+$/.test(p) || p.length > 80) {
        ctx.addIssue({ code: "custom", message: "Invalid slug list." });
        return z.NEVER;
      }
    }
    return [...new Set(parts)];
  })
  .optional();

export const builderPoolQuerySchema = z.object({
  subjects: commaSlugs,
  topics: commaSlugs,
  difficulty: z.enum(["easy", "medium", "hard"]).optional(),
  type: z.enum(["mcq", "msq", "nat"]).optional(),
});

export type BuilderPoolQuery = z.infer<typeof builderPoolQuerySchema>;

export const builderCreateSchema = z.object({
  subjectSlugs: slugList,
  topicSlugs: slugList,
  difficulty: z.enum(["easy", "medium", "hard"]).optional(),
  type: z.enum(["mcq", "msq", "nat"]).optional(),
  totalQuestions: z.number().int().min(5).max(50),
  durationSeconds: z.number().int().min(300).max(10800).optional(),
});

export type BuilderCreate = z.infer<typeof builderCreateSchema>;

/* ---------- Trends + sheets ---------- */

export const trendsQuerySchema = z.object({
  fromYear: z.coerce.number().int().min(1990).max(2100).optional(),
  subject: slug.optional(),
});

export type TrendsQuery = z.infer<typeof trendsQuerySchema>;

export const sheetContentSchema = z.object({
  contentMd: z.string().trim().min(10).max(60000),
});

export type SheetContent = z.infer<typeof sheetContentSchema>;

/* ---------- Mentor variant questions ---------- */

export const variantRequestSchema = z.object({
  count: z.number().int().min(1).max(3).optional(),
  difficulty: z.enum(["easy", "medium", "hard"]).optional(),
});

export type VariantRequest = z.infer<typeof variantRequestSchema>;

export const variantAnswerSchema = z.object({
  answer: submittedAnswerSchema,
});

export type VariantAnswer = z.infer<typeof variantAnswerSchema>;

export const variantPromoteSchema = z.object({
  subjectId: z.string().uuid(),
  topicId: z.string().uuid(),
  year: z.number().int().min(1990).max(2100).optional(),
  marks: z.number().positive().max(20).optional(),
});
