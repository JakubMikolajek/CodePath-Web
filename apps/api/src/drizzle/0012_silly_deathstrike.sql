CREATE TABLE "docs_summary_cache" (
	"content_hash" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"file_path" text NOT NULL,
	"id" serial PRIMARY KEY NOT NULL,
	"repo_id" integer NOT NULL,
	"summary" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "uq_docs_summary_cache_repo_file_path" UNIQUE("repo_id","file_path")
);
--> statement-breakpoint
ALTER TABLE "docs_summary_cache" ADD CONSTRAINT "docs_summary_cache_repo_id_fkey" FOREIGN KEY ("repo_id") REFERENCES "public"."repos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_docs_summary_cache_repo_id" ON "docs_summary_cache" USING btree ("repo_id" int4_ops);