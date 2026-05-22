ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "auth_provider" text DEFAULT 'local' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "auth_subject" text;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "users_auth_provider_subject_key"
ON "users" ("auth_provider","auth_subject")
WHERE "auth_subject" IS NOT NULL;
