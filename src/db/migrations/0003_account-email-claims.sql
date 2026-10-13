DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM user_accounts a JOIN user_accounts b ON a.id < b.id
    WHERE a.email_normalized IN (b.email_normalized, b.pending_email_normalized)
       OR a.pending_email_normalized IN (b.email_normalized, b.pending_email_normalized)
  ) THEN
    RAISE EXCEPTION 'Conflicting account email claims must be reconciled before migration';
  END IF;
END;
$$;
--> statement-breakpoint
CREATE FUNCTION enforce_account_email_claims() RETURNS trigger AS $$
BEGIN
  -- Serialize all email claims, including an invitation racing with a pending email change.
  PERFORM pg_advisory_xact_lock(713611033);
  IF EXISTS (
    SELECT 1 FROM user_accounts other
    WHERE other.id IS DISTINCT FROM NEW.id
      AND (other.email_normalized IN (NEW.email_normalized, NEW.pending_email_normalized)
        OR other.pending_email_normalized IN (NEW.email_normalized, NEW.pending_email_normalized))
  ) THEN
    RAISE EXCEPTION 'Account email already reserved' USING ERRCODE = '23505', CONSTRAINT = 'account_email_claim_unique';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER account_email_claims_unique BEFORE INSERT OR UPDATE OF email_normalized, pending_email_normalized
ON user_accounts FOR EACH ROW EXECUTE FUNCTION enforce_account_email_claims();
