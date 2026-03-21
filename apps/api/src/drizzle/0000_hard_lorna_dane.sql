CREATE EXTENSION IF NOT EXISTS vector;

CREATE TYPE "repo_clone_status" AS ENUM('pending', 'cloning', 'cloned', 'failed');--> statement-breakpoint
CREATE TYPE "repo_docs_status" AS ENUM('pending', 'processing', 'ready', 'failed');--> statement-breakpoint
CREATE TYPE "repo_embedding_status" AS ENUM('pending', 'processing', 'embedded', 'failed');--> statement-breakpoint
CREATE TYPE "repo_storage_provider" AS ENUM('local', 'minio');--> statement-breakpoint

CREATE TABLE "chat_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"session_id" text NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "chat_history_role_check" CHECK (role = ANY (ARRAY['user'::text, 'assistant'::text]))
);
--> statement-breakpoint
CREATE TABLE "chat_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"repo_id" integer NOT NULL,
	"name" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "dependencies" (
	"id" serial PRIMARY KEY NOT NULL,
	"repo_id" integer NOT NULL,
	"file_id" integer NOT NULL,
	"file_name" text,
	"graph" text,
	"comment" text,
	"js_doc" text,
	"decorators" text[],
	"params" text[],
	"return_type" text,
	"start_line" integer,
	"end_line" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "docs_segments" (
	"id" serial PRIMARY KEY NOT NULL,
	"file_id" integer NOT NULL,
	"kind" text NOT NULL,
	"name" text,
	"content" text NOT NULL,
	"comment" text,
	"decorators" text[],
	"params" text[],
	"return_type" text,
	"js_doc" text,
	"start_line" integer,
	"end_line" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "embeddings" (
	"id" serial PRIMARY KEY NOT NULL,
	"file_id" integer NOT NULL,
	"content" text NOT NULL,
	"embedding" vector(384),
	"symbol_kind" text DEFAULT 'fragment' NOT NULL,
	"symbol_name" text
);
--> statement-breakpoint
CREATE TABLE "files" (
	"id" serial PRIMARY KEY NOT NULL,
	"repo_id" integer NOT NULL,
	"path" text NOT NULL,
	"last_modified" timestamp,
	"hash" text
);
--> statement-breakpoint
CREATE TABLE "repos" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"name" text NOT NULL,
	"path" text,
	"git_url" text NOT NULL,
	"access_key" text,
	"clone_status" "repo_clone_status" DEFAULT 'pending' NOT NULL,
	"docs_status" "repo_docs_status" DEFAULT 'pending' NOT NULL,
	"embedding_status" "repo_embedding_status" DEFAULT 'pending' NOT NULL,
	"indexed_at" timestamp DEFAULT now(),
	"source_commit_sha" text,
	"storage_provider" "repo_storage_provider" DEFAULT 'local' NOT NULL,
	"storage_bucket" text,
	"storage_key" text,
	"documentation" text
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"login" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "users_email_key" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "chat_history" ADD CONSTRAINT "chat_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_history" ADD CONSTRAINT "chat_history_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."chat_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_sessions_repo_id_fkey" FOREIGN KEY ("repo_id") REFERENCES "public"."repos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dependencies" ADD CONSTRAINT "dependencies_repo_id_fkey" FOREIGN KEY ("repo_id") REFERENCES "public"."repos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dependencies" ADD CONSTRAINT "dependencies_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "docs_segments" ADD CONSTRAINT "docs_segments_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "embeddings" ADD CONSTRAINT "embeddings_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_repo_id_fkey" FOREIGN KEY ("repo_id") REFERENCES "public"."repos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repos" ADD CONSTRAINT "repos_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_chat_history_created_at" ON "chat_history" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_chat_history_user_session" ON "chat_history" USING btree ("user_id","session_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_dependencies_file_id" ON "dependencies" USING btree ("file_id");--> statement-breakpoint
CREATE INDEX "idx_dependencies_repo_id" ON "dependencies" USING btree ("repo_id");--> statement-breakpoint
CREATE INDEX "idx_files_repo_id" ON "files" USING btree ("repo_id");--> statement-breakpoint
CREATE INDEX "idx_repos_clone_status" ON "repos" USING btree ("clone_status");--> statement-breakpoint
CREATE INDEX "idx_repos_docs_status" ON "repos" USING btree ("docs_status");--> statement-breakpoint
CREATE INDEX "idx_repos_embedding_status" ON "repos" USING btree ("embedding_status");--> statement-breakpoint
CREATE INDEX "idx_embeddings_vector" ON "embeddings" USING ivfflat ("embedding" vector_cosine_ops) WITH (lists=100);
