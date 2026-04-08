DO $$
BEGIN
  CREATE TYPE "repo_git_auth_type" AS ENUM ('none', 'https_token', 'ssh_key');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

ALTER TABLE "repos"
ADD COLUMN IF NOT EXISTS "default_branch" text;
--> statement-breakpoint

ALTER TABLE "repos"
ADD COLUMN IF NOT EXISTS "git_auth_type" "repo_git_auth_type" DEFAULT 'none' NOT NULL;
--> statement-breakpoint

ALTER TABLE "repos"
ADD COLUMN IF NOT EXISTS "git_auth_username" text;
--> statement-breakpoint

ALTER TABLE "repos"
ADD COLUMN IF NOT EXISTS "git_auth_secret" text;
--> statement-breakpoint

UPDATE "repos"
SET
  "git_auth_type" = 'ssh_key',
  "git_auth_secret" = "access_key"
WHERE
  COALESCE(trim("git_auth_secret"), '') = ''
  AND COALESCE(trim("access_key"), '') <> '';
