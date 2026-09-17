ALTER TABLE "question_images" ALTER COLUMN "data_base64" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "question_images" ADD COLUMN "url" text;