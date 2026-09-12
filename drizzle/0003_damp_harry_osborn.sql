ALTER TABLE "questions" ADD COLUMN "external_id" text;--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "source_page" integer;--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "extraction_confidence" real;