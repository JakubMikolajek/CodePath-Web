-- Description: Notify the API when repository pipeline or evaluation-run state changes are written directly to PostgreSQL.
-- Risk: Additive and non-locking. CREATE TRIGGER does not rewrite or lock either table.
-- Rollback: Drop the triggers and helper functions; no data is changed or lost.
-- Estimated duration: Near-instant regardless of table size.

-- Up
CREATE OR REPLACE FUNCTION notify_realtime_repo_changed() RETURNS trigger AS $$
BEGIN
  PERFORM pg_notify('realtime_repo_changed', json_build_object('id', NEW.id)::text);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER realtime_repo_changed_trigger
AFTER UPDATE OF clone_status, embedding_status, docs_status ON repos
FOR EACH ROW
WHEN (
  OLD.clone_status IS DISTINCT FROM NEW.clone_status
  OR OLD.embedding_status IS DISTINCT FROM NEW.embedding_status
  OR OLD.docs_status IS DISTINCT FROM NEW.docs_status
)
EXECUTE FUNCTION notify_realtime_repo_changed();--> statement-breakpoint
CREATE OR REPLACE FUNCTION notify_realtime_evaluation_run_changed() RETURNS trigger AS $$
BEGIN
  PERFORM pg_notify('realtime_evaluation_run_changed', json_build_object('id', NEW.id, 'repoId', NEW.repo_id)::text);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER realtime_evaluation_run_changed_trigger
AFTER UPDATE OF status ON evaluation_runs
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION notify_realtime_evaluation_run_changed();

-- Down (manual rollback; Drizzle migrations are forward-only)
-- DROP TRIGGER IF EXISTS realtime_repo_changed_trigger ON repos;
-- DROP FUNCTION IF EXISTS notify_realtime_repo_changed();
-- DROP TRIGGER IF EXISTS realtime_evaluation_run_changed_trigger ON evaluation_runs;
-- DROP FUNCTION IF EXISTS notify_realtime_evaluation_run_changed();
