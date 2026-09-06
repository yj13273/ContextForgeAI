CREATE TABLE "memories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"employee_id" uuid,
	"coworker_id" uuid,
	"type" varchar(50) NOT NULL,
	"title" varchar(500) NOT NULL,
	"content" text NOT NULL,
	"source_type" varchar(100) DEFAULT 'manual' NOT NULL,
	"source_id" varchar(255),
	"importance" integer DEFAULT 3 NOT NULL,
	"confidence" double precision DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "memories" ADD CONSTRAINT "memories_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memories" ADD CONSTRAINT "memories_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memories" ADD CONSTRAINT "memories_coworker_id_coworkers_id_fk" FOREIGN KEY ("coworker_id") REFERENCES "public"."coworkers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "memories_org_idx" ON "memories" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "memories_employee_idx" ON "memories" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "memories_coworker_idx" ON "memories" USING btree ("coworker_id");--> statement-breakpoint
CREATE INDEX "memories_type_idx" ON "memories" USING btree ("type");--> statement-breakpoint
CREATE INDEX "memories_org_type_idx" ON "memories" USING btree ("organization_id","type");