-- Protect the historical references/provenance not expressible as a cross-table CHECK.
CREATE TRIGGER immutable_published_task_version BEFORE UPDATE ON task_published_versions FOR EACH ROW EXECUTE FUNCTION prevent_game_evidence_mutation();
--> statement-breakpoint
CREATE TRIGGER preserve_approved_method BEFORE DELETE ON indicator_rule_versions FOR EACH ROW WHEN (OLD.approval_status = 'APPROVED') EXECUTE FUNCTION prevent_game_evidence_mutation();
--> statement-breakpoint
CREATE FUNCTION validate_game_session_history() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE expected_task text; expected_group uuid; run_session uuid;
BEGIN
  SELECT a.task_id, a.group_id INTO expected_task, expected_group
    FROM task_assignment_recipients r JOIN task_assignments a ON a.id = r.assignment_id
    WHERE r.id = NEW.recipient_id AND r.student_id = NEW.student_id;
  IF expected_task IS NULL OR NEW.task_id <> expected_task OR
     (NEW.group_id_at_start IS NOT NULL AND NEW.group_id_at_start <> expected_group) THEN
    RAISE EXCEPTION 'Session recipient/task provenance mismatch';
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF ROW(NEW.id, NEW.recipient_id, NEW.student_id, NEW.task_id, NEW.prepared_at, NEW.launch_mode)
       IS DISTINCT FROM ROW(OLD.id, OLD.recipient_id, OLD.student_id, OLD.task_id, OLD.prepared_at, OLD.launch_mode) THEN
      RAISE EXCEPTION 'Immutable session provenance';
    END IF;
    IF OLD.attempt_number IS NOT NULL AND ROW(NEW.attempt_number, NEW.started_at_server, NEW.start_request_id, NEW.upload_allowed_until, NEW.group_id_at_start, NEW.participation_authorization_ref)
       IS DISTINCT FROM ROW(OLD.attempt_number, OLD.started_at_server, OLD.start_request_id, OLD.upload_allowed_until, OLD.group_id_at_start, OLD.participation_authorization_ref) THEN
      RAISE EXCEPTION 'Immutable confirmed attempt';
    END IF;
  END IF;
  IF NEW.active_calculation_run_id IS NOT NULL THEN
    SELECT session_id INTO run_session FROM indicator_calculation_runs WHERE id = NEW.active_calculation_run_id;
    IF run_session IS DISTINCT FROM NEW.id THEN RAISE EXCEPTION 'Calculation belongs to another session'; END IF;
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER protect_game_session_history BEFORE INSERT OR UPDATE ON task_sessions FOR EACH ROW EXECUTE FUNCTION validate_game_session_history();
--> statement-breakpoint
CREATE FUNCTION prevent_assignment_reopening() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status = 'CANCELLED' AND NEW.status <> 'CANCELLED' THEN RAISE EXCEPTION 'Cancelled assignment is immutable'; END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER prevent_assignment_reopening BEFORE UPDATE ON task_assignments FOR EACH ROW EXECUTE FUNCTION prevent_assignment_reopening();
