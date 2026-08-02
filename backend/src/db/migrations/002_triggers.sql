-- Ticket code sequence
CREATE SEQUENCE IF NOT EXISTS ticket_seq START 1;

CREATE OR REPLACE FUNCTION generate_ticket_code()
RETURNS TRIGGER AS $$
DECLARE
  year_prefix TEXT := to_char(now(), 'YYYY');
  seq_num     TEXT;
BEGIN
  seq_num := LPAD(nextval('ticket_seq')::TEXT, 3, '0');
  NEW.ticket_code := 'SOL-' || year_prefix || '-' || seq_num;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_requests_ticket_code ON requests;
CREATE TRIGGER trg_requests_ticket_code
  BEFORE INSERT ON requests
  FOR EACH ROW
  EXECUTE FUNCTION generate_ticket_code();

-- Status change audit log
CREATE OR REPLACE FUNCTION log_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO request_status_history (request_id, from_status, to_status, changed_by, comment)
    VALUES (NEW.request_id, OLD.status, NEW.status, COALESCE(NEW.assigned_to, OLD.assigned_to), NEW.rejection_reason);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_requests_status_change ON requests;
CREATE TRIGGER trg_requests_status_change
  AFTER UPDATE OF status ON requests
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION log_status_change();

-- Updated_at auto-update
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_requests_updated_at ON requests;
CREATE TRIGGER trg_requests_updated_at
  BEFORE UPDATE ON requests
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
