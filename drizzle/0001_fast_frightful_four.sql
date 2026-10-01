CREATE TABLE "ask_query" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"user_id" text,
	"question" text NOT NULL,
	"answer" text,
	"citations" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"grounded" boolean DEFAULT false NOT NULL,
	"plan" text NOT NULL,
	"engine_mode" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ask_query" ADD CONSTRAINT "ask_query_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ask_query" ADD CONSTRAINT "ask_query_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ask_query_organizationId_idx" ON "ask_query" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "ask_query_organizationId_createdAt_idx" ON "ask_query" USING btree ("organization_id","created_at");