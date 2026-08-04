-- Fix: request_status_history.changed_by must record the ACTUAL user who changed
-- the status, not the assignee. The application sets the session GUC
-- 'app.current_user_id' before the UPDATE; the trigger reads it. Falls back to
-- the assignee for direct DB updates made outside the application.
CREATE OR REPLACE FUNCTION log_status_change()
RETURNS TRIGGER AS $$
DECLARE
  actor_id BIGINT;
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    actor_id := NULLIF(current_setting('app.current_user_id', true), '')::bigint;
    IF actor_id IS NULL THEN
      actor_id := COALESCE(NEW.assigned_to, OLD.assigned_to);
    END IF;
    INSERT INTO request_status_history (request_id, from_status, to_status, changed_by, comment)
    VALUES (NEW.request_id, OLD.status, NEW.status, actor_id, NEW.rejection_reason);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
