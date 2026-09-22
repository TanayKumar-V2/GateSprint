CREATE TYPE "public"."topic_override" AS ENUM('skipped', 'focus');--> statement-breakpoint
CREATE TABLE "topic_overrides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"topic_id" uuid NOT NULL,
	"status" "topic_override" NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "topic_overrides_user_topic_unique" UNIQUE("user_id","topic_id")
);
--> statement-breakpoint
ALTER TABLE "topic_overrides" ADD CONSTRAINT "topic_overrides_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topic_overrides" ADD CONSTRAINT "topic_overrides_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "topic_overrides_user_idx" ON "topic_overrides" USING btree ("user_id");