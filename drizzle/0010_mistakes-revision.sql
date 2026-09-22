CREATE TYPE "public"."mistake_tag" AS ENUM('concept_gap', 'silly_mistake', 'trap', 'time_pressure', 'unattempted');--> statement-breakpoint
CREATE TABLE "mistakes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"question_id" uuid NOT NULL,
	"tag" "mistake_tag",
	"miss_count" integer DEFAULT 1 NOT NULL,
	"last_missed_at" timestamp DEFAULT now() NOT NULL,
	"resolved" boolean DEFAULT false NOT NULL,
	"resolved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "mistakes_user_question_unique" UNIQUE("user_id","question_id")
);
--> statement-breakpoint
ALTER TABLE "mistakes" ADD CONSTRAINT "mistakes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mistakes" ADD CONSTRAINT "mistakes_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "mistakes_user_resolved_missed_idx" ON "mistakes" USING btree ("user_id","resolved","last_missed_at");