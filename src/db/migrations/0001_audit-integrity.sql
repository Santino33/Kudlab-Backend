CREATE FUNCTION reject_account_audit_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'account_audit_events is append-only';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER account_audit_append_only BEFORE UPDATE OR DELETE ON account_audit_events
FOR EACH ROW EXECUTE FUNCTION reject_account_audit_mutation();
--> statement-breakpoint
REVOKE UPDATE, DELETE ON account_audit_events FROM PUBLIC;
