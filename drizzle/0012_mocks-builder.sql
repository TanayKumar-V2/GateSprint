CREATE TYPE "public"."mock_status" AS ENUM('in_progress', 'submitted', 'expired', 'abandoned');--> statement-breakpoint
CREATE TYPE "public"."mock_type" AS ENUM('full', 'sectional', 'pyq_year');--> statement-breakpoint
CREATE TABLE "mock_session_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"status" text DEFAULT 'unanswered' NOT NULL,
	"selected_answer" jsonb,
	"is_correct" boolean,
	"time_taken_seconds" integer DEFAULT 0 NOT NULL,
	"marked_for_review" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "mock_session_items_session_question_unique" UNIQUE("session_id","question_id")
);
--> statement-breakpoint
CREATE TABLE "mock_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"type" "mock_type" NOT NULL,
	"title" text NOT NULL,
	"total_marks" real DEFAULT 0 NOT NULL,
	"duration_seconds" integer NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"ends_at" timestamp NOT NULL,
	"submitted_at" timestamp,
	"status" "mock_status" DEFAULT 'in_progress' NOT NULL,
	"config" jsonb,
	"score" real,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "mock_session_items" ADD CONSTRAINT "mock_session_items_session_id_mock_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."mock_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mock_session_items" ADD CONSTRAINT "mock_session_items_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mock_sessions" ADD CONSTRAINT "mock_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "mock_session_items_session_position_idx" ON "mock_session_items" USING btree ("session_id","position");--> statement-breakpoint
CREATE INDEX "mock_sessions_user_created_idx" ON "mock_sessions" USING btree ("user_id","created_at");