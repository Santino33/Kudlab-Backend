CREATE TABLE "task_access_claims" (
	"claim_id" uuid PRIMARY KEY NOT NULL,
	"code_id" uuid NOT NULL,
	"capability_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"submission_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "task_access_claims_capability_id_unique" UNIQUE("capability_id")
);
--> statement-breakpoint
CREATE TABLE "task_access_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipient_id" uuid NOT NULL,
	"scope" text NOT NULL,
	"session_id" uuid,
	"lookup_digest" text NOT NULL,
	"secret_ciphertext" text NOT NULL,
	"encryption_key_id" text NOT NULL,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"issued_by_account_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"replaced_by_id" uuid,
	"last_claimed_at" timestamp with time zone,
	CONSTRAINT "task_access_codes_lookup_digest_unique" UNIQUE("lookup_digest"),
	CONSTRAINT "access_code_scope_check" CHECK (("task_access_codes"."scope" = 'PLAY_AND_SUBMIT' and "task_access_codes"."session_id" is null) or ("task_access_codes"."scope" = 'SUBMIT_ONLY' and "task_access_codes"."session_id" is not null))
);
--> statement-breakpoint
CREATE TABLE "task_access_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"events" jsonb NOT NULL,
	"tokens" double precision NOT NULL,
	"touched_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "task_sessions" ADD COLUMN "source_access_code_id" uuid;--> statement-breakpoint
ALTER TABLE "task_runtime_capabilities" ADD COLUMN "source_access_code_id" uuid;--> statement-breakpoint
ALTER TABLE "task_access_claims" ADD CONSTRAINT "task_access_claims_code_id_task_access_codes_id_fk" FOREIGN KEY ("code_id") REFERENCES "public"."task_access_codes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_access_claims" ADD CONSTRAINT "task_access_claims_capability_id_task_runtime_capabilities_id_fk" FOREIGN KEY ("capability_id") REFERENCES "public"."task_runtime_capabilities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_access_claims" ADD CONSTRAINT "task_access_claims_session_id_task_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."task_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_access_codes" ADD CONSTRAINT "task_access_codes_recipient_id_task_assignment_recipients_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."task_assignment_recipients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_access_codes" ADD CONSTRAINT "task_access_codes_session_id_task_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."task_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_access_codes" ADD CONSTRAINT "task_access_codes_issued_by_account_id_user_accounts_id_fk" FOREIGN KEY ("issued_by_account_id") REFERENCES "public"."user_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "one_active_play_code" ON "task_access_codes" USING btree ("recipient_id") WHERE "task_access_codes"."status" = 'ACTIVE' and "task_access_codes"."scope" = 'PLAY_AND_SUBMIT';--> statement-breakpoint
CREATE UNIQUE INDEX "one_active_recovery_code" ON "task_access_codes" USING btree ("session_id") WHERE "task_access_codes"."status" = 'ACTIVE' and "task_access_codes"."scope" = 'SUBMIT_ONLY';
--> statement-breakpoint
ALTER TABLE task_access_codes ADD CONSTRAINT access_code_state_check CHECK (status IN ('ACTIVE','REVOKED','REPLACED','EXPIRED') AND expires_at > created_at);
ALTER TABLE task_access_codes ADD CONSTRAINT access_code_replacement_fk FOREIGN KEY (replaced_by_id) REFERENCES task_access_codes(id);
ALTER TABLE task_sessions ADD CONSTRAINT session_source_code_fk FOREIGN KEY (source_access_code_id) REFERENCES task_access_codes(id);
ALTER TABLE task_runtime_capabilities ADD CONSTRAINT capability_source_code_fk FOREIGN KEY (source_access_code_id) REFERENCES task_access_codes(id);
ALTER TABLE task_sessions ADD CONSTRAINT game_launch_mode_check CHECK ((launch_mode = 'SUPERVISED' AND source_access_code_id IS NULL) OR (launch_mode = 'CODE' AND source_access_code_id IS NOT NULL));
--> statement-breakpoint
CREATE FUNCTION validate_access_provenance() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE c task_access_codes; s task_sessions; cap task_runtime_capabilities;
BEGIN
  IF TG_TABLE_NAME = 'task_access_codes' THEN
    IF NEW.session_id IS NOT NULL THEN
      SELECT * INTO s FROM task_sessions WHERE id = NEW.session_id;
      IF s.recipient_id IS DISTINCT FROM NEW.recipient_id OR s.attempt_number IS NULL THEN RAISE EXCEPTION 'Recovery session mismatch'; END IF;
    END IF;
    IF TG_OP = 'UPDATE' THEN
      IF ROW(NEW.id,NEW.recipient_id,NEW.scope,NEW.session_id,NEW.lookup_digest,NEW.issued_by_account_id,NEW.created_at,NEW.expires_at)
        IS DISTINCT FROM ROW(OLD.id,OLD.recipient_id,OLD.scope,OLD.session_id,OLD.lookup_digest,OLD.issued_by_account_id,OLD.created_at,OLD.expires_at)
        OR (OLD.status <> 'ACTIVE' AND NEW.status <> OLD.status) THEN RAISE EXCEPTION 'Immutable access provenance'; END IF;
    END IF;
  ELSIF TG_TABLE_NAME = 'task_sessions' THEN
    IF NEW.source_access_code_id IS NOT NULL THEN
      SELECT * INTO c FROM task_access_codes WHERE id = NEW.source_access_code_id;
      IF c.recipient_id IS DISTINCT FROM NEW.recipient_id OR c.scope <> 'PLAY_AND_SUBMIT' THEN RAISE EXCEPTION 'Session code mismatch'; END IF;
    END IF;
    IF TG_OP = 'UPDATE' AND NEW.source_access_code_id IS DISTINCT FROM OLD.source_access_code_id THEN RAISE EXCEPTION 'Immutable session source'; END IF;
  ELSIF TG_TABLE_NAME = 'task_runtime_capabilities' THEN
    IF NEW.source_access_code_id IS NOT NULL THEN
      SELECT * INTO c FROM task_access_codes WHERE id = NEW.source_access_code_id;
      SELECT * INTO s FROM task_sessions WHERE id = NEW.session_id;
      IF c.recipient_id IS DISTINCT FROM s.recipient_id OR (c.scope = 'SUBMIT_ONLY' AND (c.session_id IS DISTINCT FROM s.id OR NEW.can_start OR NEW.submission_id IS NULL)) THEN RAISE EXCEPTION 'Capability code mismatch'; END IF;
    END IF;
    IF TG_OP = 'UPDATE' AND ROW(NEW.source_access_code_id,NEW.session_id,NEW.claim_id,NEW.secret_digest,NEW.submission_id) IS DISTINCT FROM ROW(OLD.source_access_code_id,OLD.session_id,OLD.claim_id,OLD.secret_digest,OLD.submission_id) THEN RAISE EXCEPTION 'Immutable capability source'; END IF;
  ELSE
    SELECT * INTO cap FROM task_runtime_capabilities WHERE id = NEW.capability_id;
    IF ROW(cap.session_id,cap.source_access_code_id,cap.claim_id,cap.submission_id) IS DISTINCT FROM ROW(NEW.session_id,NEW.code_id,NEW.claim_id,NEW.submission_id) THEN RAISE EXCEPTION 'Claim provenance mismatch'; END IF;
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER access_code_history BEFORE INSERT OR UPDATE ON task_access_codes FOR EACH ROW EXECUTE FUNCTION validate_access_provenance();
CREATE TRIGGER session_access_history BEFORE INSERT OR UPDATE ON task_sessions FOR EACH ROW EXECUTE FUNCTION validate_access_provenance();
CREATE TRIGGER capability_access_history BEFORE INSERT OR UPDATE ON task_runtime_capabilities FOR EACH ROW EXECUTE FUNCTION validate_access_provenance();
CREATE TRIGGER access_claim_provenance BEFORE INSERT ON task_access_claims FOR EACH ROW EXECUTE FUNCTION validate_access_provenance();
CREATE TRIGGER immutable_access_claim BEFORE UPDATE OR DELETE ON task_access_claims FOR EACH ROW EXECUTE FUNCTION prevent_game_evidence_mutation();
--> statement-breakpoint
CREATE FUNCTION revoke_transferred_access() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.teacher_id IS DISTINCT FROM OLD.teacher_id THEN
    UPDATE task_access_codes c SET status = 'REVOKED', revoked_at = now()
      FROM task_assignment_recipients r JOIN task_assignments a ON a.id = r.assignment_id
      WHERE c.recipient_id = r.id AND a.group_id = OLD.id AND c.status = 'ACTIVE';
    UPDATE task_runtime_capabilities cap SET revoked_at = now() FROM task_sessions s
      JOIN task_access_codes c ON c.id = s.source_access_code_id
      JOIN task_assignment_recipients r ON r.id = c.recipient_id
      JOIN task_assignments a ON a.id = r.assignment_id
      WHERE cap.session_id = s.id AND s.execution_status = 'READY' AND a.group_id = OLD.id;
    UPDATE task_sessions s SET execution_status = 'EXPIRED' FROM task_assignment_recipients r JOIN task_assignments a ON a.id = r.assignment_id
      WHERE s.recipient_id = r.id AND a.group_id = OLD.id AND s.launch_mode = 'CODE' AND s.execution_status = 'READY';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER revoke_transferred_access BEFORE UPDATE OF teacher_id ON groups FOR EACH ROW EXECUTE FUNCTION revoke_transferred_access();
