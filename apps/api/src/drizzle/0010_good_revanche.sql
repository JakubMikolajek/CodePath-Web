CREATE TYPE "public"."repo_docs_fragment_type" AS ENUM('module_summary', 'section');--> statement-breakpoint
ALTER TABLE "repos" ADD COLUMN "docs_progress_current" integer;--> statement-breakpoint
ALTER TABLE "repos" ADD COLUMN "docs_progress_message" text;--> statement-breakpoint
ALTER TABLE "repos" ADD COLUMN "docs_progress_module_key" text;--> statement-breakpoint
ALTER TABLE "repos" ADD COLUMN "docs_progress_scope" text;--> statement-breakpoint
ALTER TABLE "repos" ADD COLUMN "docs_progress_section_key" text;--> statement-breakpoint
ALTER TABLE "repos" ADD COLUMN "docs_progress_stage" text;--> statement-breakpoint
ALTER TABLE "repos" ADD COLUMN "docs_progress_total" integer;--> statement-breakpoint
ALTER TABLE "repos" ADD COLUMN "docs_progress_updated_at" timestamp;--> statement-breakpoint
CREATE TABLE "repo_docs_fragments" (
	"created_at" timestamp DEFAULT now(),
	"error" text,
	"fragment_key" text NOT NULL,
	"fragment_type" "repo_docs_fragment_type" NOT NULL,
	"generated_at" timestamp,
	"id" serial PRIMARY KEY NOT NULL,
	"markdown" text,
	"module_key" text NOT NULL,
	"module_path" text,
	"module_title" text NOT NULL,
	"repo_id" integer NOT NULL,
	"section_key" text,
	"section_title" text,
	"status" "repo_docs_status" DEFAULT 'pending' NOT NULL,
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "uq_repo_docs_fragments_scope" UNIQUE("repo_id","module_key","fragment_type","fragment_key")
);
--> statement-breakpoint
ALTER TABLE "repo_docs_fragments" ADD CONSTRAINT "repo_docs_fragments_repo_id_fkey" FOREIGN KEY ("repo_id") REFERENCES "public"."repos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_repo_docs_fragments_repo_id" ON "repo_docs_fragments" USING btree ("repo_id" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_repo_docs_fragments_repo_module" ON "repo_docs_fragments" USING btree ("repo_id" int4_ops,"module_key" text_ops);
