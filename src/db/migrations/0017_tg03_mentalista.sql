CREATE TABLE "mentalista_session_evidence" (
	"session_id" uuid PRIMARY KEY NOT NULL,
	"receipt_id" uuid NOT NULL,
	"envelope" jsonb NOT NULL,
	CONSTRAINT "mentalista_session_evidence_receipt_id_unique" UNIQUE("receipt_id"),
	CONSTRAINT "mentalista_identity_check" CHECK ("mentalista_session_evidence"."envelope"->>'taskId' = 'TG-03' and "mentalista_session_evidence"."envelope"->>'sessionId' = "mentalista_session_evidence"."session_id"::text and jsonb_array_length("mentalista_session_evidence"."envelope"->'events') <= 12)
);
--> statement-breakpoint
ALTER TABLE "mentalista_session_evidence" ADD CONSTRAINT "mentalista_session_evidence_session_id_task_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."task_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mentalista_session_evidence" ADD CONSTRAINT "mentalista_session_evidence_receipt_id_task_result_receipts_id_fk" FOREIGN KEY ("receipt_id") REFERENCES "public"."task_result_receipts"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE TRIGGER immutable_mentalista_evidence BEFORE UPDATE OR DELETE ON mentalista_session_evidence
FOR EACH ROW EXECUTE FUNCTION prevent_game_evidence_mutation();
--> statement-breakpoint
CREATE FUNCTION validate_mentalista_receipt() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM task_result_receipts r JOIN task_sessions s ON s.id = r.session_id
    WHERE r.id = NEW.receipt_id AND r.session_id = NEW.session_id AND s.task_id = 'TG-03'
      AND r.submission_id::text = NEW.envelope->>'submissionId' AND r.contract_version = '2.0') THEN
    RAISE EXCEPTION 'Mentalista receipt mismatch' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER mentalista_receipt_identity BEFORE INSERT ON mentalista_session_evidence
FOR EACH ROW EXECUTE FUNCTION validate_mentalista_receipt();
