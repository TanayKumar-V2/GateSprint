CREATE TABLE "generated_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"prompt" text NOT NULL,
	"type" "question_type" NOT NULL,
	"options" jsonb,
	"correct_answer" jsonb NOT NULL,
	"difficulty" "difficulty" DEFAULT 'medium' NOT NULL,
	"topic_id" uuid,
	"verified" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "generated_questions" ADD CONSTRAINT "generated_questions_session_id_chat_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."chat_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generated_questions" ADD CONSTRAINT "generated_questions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generated_questions" ADD CONSTRAINT "generated_questions_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "generated_questions_session_created_idx" ON "generated_questions" USING btree ("session_id","created_at");