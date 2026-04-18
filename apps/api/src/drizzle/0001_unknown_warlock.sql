ALTER TABLE "embeddings" ADD COLUMN "comment" text;--> statement-breakpoint
ALTER TABLE "embeddings" ADD COLUMN "js_doc" text;--> statement-breakpoint
ALTER TABLE "embeddings" ADD COLUMN "decorators" text[];--> statement-breakpoint
ALTER TABLE "embeddings" ADD COLUMN "params" text[];--> statement-breakpoint
ALTER TABLE "embeddings" ADD COLUMN "return_type" text;--> statement-breakpoint
ALTER TABLE "embeddings" ADD COLUMN "start_line" integer;--> statement-breakpoint
ALTER TABLE "embeddings" ADD COLUMN "end_line" integer;