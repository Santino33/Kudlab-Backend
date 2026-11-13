CREATE TABLE "palabra_intrusa_session_evidence" (
	"session_id" uuid PRIMARY KEY NOT NULL,
	"receipt_id" uuid NOT NULL,
	"envelope" jsonb NOT NULL,
	CONSTRAINT "palabra_intrusa_session_evidence_receipt_id_unique" UNIQUE("receipt_id"),
	CONSTRAINT "palabra_intrusa_identity_check" CHECK ("palabra_intrusa_session_evidence"."envelope"->>'taskId' = 'TG-02' and "palabra_intrusa_session_evidence"."envelope"->>'sessionId' = "palabra_intrusa_session_evidence"."session_id"::text and jsonb_array_length("palabra_intrusa_session_evidence"."envelope"->'events') <= 18)
);
--> statement-breakpoint
ALTER TABLE "palabra_intrusa_session_evidence" ADD CONSTRAINT "palabra_intrusa_session_evidence_session_id_task_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."task_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "palabra_intrusa_session_evidence" ADD CONSTRAINT "palabra_intrusa_session_evidence_receipt_id_task_result_receipts_id_fk" FOREIGN KEY ("receipt_id") REFERENCES "public"."task_result_receipts"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE TRIGGER immutable_palabra_intrusa_evidence BEFORE UPDATE OR DELETE ON palabra_intrusa_session_evidence
FOR EACH ROW EXECUTE FUNCTION prevent_game_evidence_mutation();
--> statement-breakpoint
CREATE FUNCTION validate_palabra_intrusa_receipt() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM task_result_receipts r JOIN task_sessions s ON s.id = r.session_id
    WHERE r.id = NEW.receipt_id AND r.session_id = NEW.session_id AND s.task_id = 'TG-02'
      AND r.submission_id::text = NEW.envelope->>'submissionId' AND r.contract_version = '2.0') THEN
    RAISE EXCEPTION 'Palabra Intrusa receipt mismatch' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER palabra_intrusa_receipt_identity BEFORE INSERT ON palabra_intrusa_session_evidence
FOR EACH ROW EXECUTE FUNCTION validate_palabra_intrusa_receipt();
