CREATE TYPE "public"."evaluation_run_status" AS ENUM('pending', 'running', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."evaluation_run_type" AS ENUM('docs_quality', 'retrieval', 'chat_faithfulness', 'full');--> statement-breakpoint
CREATE TABLE "evaluation_metrics" (
	"created_at" timestamp DEFAULT now() NOT NULL,
	"id" serial PRIMARY KEY NOT NULL,
	"metric_name" text NOT NULL,
	"metric_value" double precision NOT NULL,
	"run_id" integer NOT NULL,
	"target_ref" text
);
--> statement-breakpoint
CREATE TABLE "evaluation_runs" (
	"completed_at" timestamp,
	"error_message" text,
	"id" serial PRIMARY KEY NOT NULL,
	"repo_id" integer NOT NULL,
	"run_type" "evaluation_run_type" NOT NULL,
	"status" "evaluation_run_status" DEFAULT 'pending' NOT NULL,
	"triggered_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "evaluation_metrics" ADD CONSTRAINT "evaluation_metrics_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "public"."evaluation_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evaluation_runs" ADD CONSTRAINT "evaluation_runs_repo_id_fkey" FOREIGN KEY ("repo_id") REFERENCES "public"."repos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_evaluation_metrics_run_id" ON "evaluation_metrics" USING btree ("run_id" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_evaluation_runs_repo_id" ON "evaluation_runs" USING btree ("repo_id" int4_ops);