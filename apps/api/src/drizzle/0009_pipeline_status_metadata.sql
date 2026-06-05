ALTER TABLE "repos" ADD COLUMN IF NOT EXISTS "pipeline_updated_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "repos" ADD COLUMN IF NOT EXISTS "last_pipeline_error" text;
