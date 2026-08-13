CREATE TABLE "usage" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"model" text,
	"complexity" text,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"total_tokens" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "usage" ADD CONSTRAINT "usage_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "usage_user_id_idx" ON "usage" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "usage_created_at_idx" ON "usage" USING btree ("created_at");