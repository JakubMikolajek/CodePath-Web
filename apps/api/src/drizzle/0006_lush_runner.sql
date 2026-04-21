CREATE TABLE "api_runner_collections" (
	"config" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"repo_id" integer NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"user_id" integer NOT NULL,
	CONSTRAINT "api_runner_collections_repo_user_name_key" UNIQUE("repo_id","user_id","name")
);
--> statement-breakpoint
ALTER TABLE "api_runner_collections" ADD CONSTRAINT "api_runner_collections_repo_id_fkey" FOREIGN KEY ("repo_id") REFERENCES "public"."repos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_runner_collections" ADD CONSTRAINT "api_runner_collections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;