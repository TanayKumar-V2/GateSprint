CREATE TABLE "sheet_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"sheet_id" uuid NOT NULL,
	"revised_at" timestamp DEFAULT now() NOT NULL,
	"day" text NOT NULL,
	CONSTRAINT "sheet_revisions_user_sheet_day_unique" UNIQUE("user_id","sheet_id","day")
);
--> statement-breakpoint
CREATE TABLE "sheets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"topic_id" uuid NOT NULL,
	"content_md" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" text,
	CONSTRAINT "sheets_topic_id_unique" UNIQUE("topic_id")
);
--> statement-breakpoint
ALTER TABLE "sheet_revisions" ADD CONSTRAINT "sheet_revisions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sheet_revisions" ADD CONSTRAINT "sheet_revisions_sheet_id_sheets_id_fk" FOREIGN KEY ("sheet_id") REFERENCES "public"."sheets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sheets" ADD CONSTRAINT "sheets_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sheet_revisions_user_idx" ON "sheet_revisions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sheets_topic_idx" ON "sheets" USING btree ("topic_id");