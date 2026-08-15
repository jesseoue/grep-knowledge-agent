CREATE TABLE "budget_reservations" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"budget_date" text NOT NULL,
	"reserved_microusd" integer NOT NULL,
	"charged_microusd" integer,
	"status" text DEFAULT 'reserved' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "usage" ADD COLUMN "cost_microusd" integer;--> statement-breakpoint
ALTER TABLE "usage" ADD COLUMN "request_id" text;--> statement-breakpoint
ALTER TABLE "usage" ADD COLUMN "call_kind" text DEFAULT 'answer' NOT NULL;--> statement-breakpoint
ALTER TABLE "budget_reservations" ADD CONSTRAINT "budget_reservations_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "budget_reservations_date_idx" ON "budget_reservations" USING btree ("budget_date");--> statement-breakpoint
CREATE INDEX "budget_reservations_user_date_idx" ON "budget_reservations" USING btree ("user_id","budget_date");--> statement-breakpoint
CREATE INDEX "usage_request_id_idx" ON "usage" USING btree ("request_id");