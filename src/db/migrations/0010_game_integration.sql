CREATE TABLE "task_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" text NOT NULL,
	"published_version_id" uuid NOT NULL,
	"group_id" uuid NOT NULL,
	"created_by_account_id" uuid NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"max_attempts" integer NOT NULL,
	"status" text DEFAULT 'OPEN' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"cancelled_at" timestamp with time zone,
	"cancelled_by" uuid,
	"creation_request_id" uuid NOT NULL,
	"request_hash" text NOT NULL,
	CONSTRAINT "task_assignments_created_by_account_id_creation_request_id_unique" UNIQUE("created_by_account_id","creation_request_id"),
	CONSTRAINT "assignment_window_check" CHECK ("task_assignments"."starts_at" < "task_assignments"."ends_at" and "task_assignments"."max_attempts" between 1 and 10),
	CONSTRAINT "assignment_state_check" CHECK (("task_assignments"."status" = 'OPEN' and "task_assignments"."cancelled_at" is null and "task_assignments"."cancelled_by" is null) or ("task_assignments"."status" = 'CANCELLED' and "task_assignments"."cancelled_at" is not null and "task_assignments"."cancelled_by" is not null))
);
--> statement-breakpoint
CREATE TABLE "calculated_indicators" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"metric_code" text NOT NULL,
	"scope" text NOT NULL,
	"availability_status" text NOT NULL,
	"value" numeric(20, 6),
	"unit" text NOT NULL,
	"numerator" integer,
	"denominator" integer,
	"sample_size" integer NOT NULL,
	"unavailability_reason" text,
	CONSTRAINT "calculated_indicators_run_id_metric_code_scope_unique" UNIQUE("run_id","metric_code","scope"),
	CONSTRAINT "indicator_availability_check" CHECK (("calculated_indicators"."availability_status" = 'CALCULATED' and "calculated_indicators"."value" is not null and "calculated_indicators"."unavailability_reason" is null) or ("calculated_indicators"."availability_status" = 'NOT_AVAILABLE' and "calculated_indicators"."value" is null and "calculated_indicators"."unavailability_reason" is not null))
);
--> statement-breakpoint
CREATE TABLE "indicator_calculation_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"rule_version_id" uuid NOT NULL,
	"run_number" integer NOT NULL,
	"evidence_hash" text NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"lease_until" timestamp with time zone,
	"lease_token" uuid,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone,
	"failure_code" text,
	"evidence_decisions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"summary" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "indicator_calculation_runs_session_id_rule_version_id_run_number_unique" UNIQUE("session_id","rule_version_id","run_number")
);
--> statement-breakpoint
CREATE TABLE "task_version_configurations" (
	"published_version_id" uuid PRIMARY KEY NOT NULL,
	"contract_version" text NOT NULL,
	"game_build_id" text NOT NULL,
	"configuration" jsonb NOT NULL,
	"configuration_hash" text NOT NULL,
	"rule_version_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipient_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"task_id" text NOT NULL,
	"group_id_at_start" uuid,
	"launch_mode" text DEFAULT 'SUPERVISED' NOT NULL,
	"attempt_number" integer,
	"execution_status" text DEFAULT 'READY' NOT NULL,
	"processing_status" text DEFAULT 'NOT_RECEIVED' NOT NULL,
	"prepared_at" timestamp with time zone DEFAULT now() NOT NULL,
	"start_allowed_until" timestamp with time zone NOT NULL,
	"started_at_server" timestamp with time zone,
	"start_request_id" uuid,
	"upload_allowed_until" timestamp with time zone,
	"closed_received_at" timestamp with time zone,
	"participation_authorization_ref" text,
	"active_calculation_run_id" uuid,
	CONSTRAINT "task_sessions_recipient_id_attempt_number_unique" UNIQUE("recipient_id","attempt_number"),
	CONSTRAINT "game_session_attempt_check" CHECK (("task_sessions"."attempt_number" is null and "task_sessions"."started_at_server" is null and "task_sessions"."start_request_id" is null and "task_sessions"."upload_allowed_until" is null) or ("task_sessions"."attempt_number" between 1 and 10 and "task_sessions"."started_at_server" is not null and "task_sessions"."start_request_id" is not null and "task_sessions"."upload_allowed_until" is not null)),
	CONSTRAINT "game_session_states_check" CHECK ("task_sessions"."execution_status" in ('READY','RUNNING','COMPLETED','INTERRUPTED','EXPIRED','UNCONFIRMED') and "task_sessions"."processing_status" in ('NOT_RECEIVED','PENDING','PROCESSING','COMPLETED','FAILED'))
);
--> statement-breakpoint
CREATE TABLE "indicator_rule_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" text NOT NULL,
	"code" text NOT NULL,
	"version" integer NOT NULL,
	"definition" jsonb NOT NULL,
	"definition_hash" text NOT NULL,
	"approval_status" text NOT NULL,
	"approved_at" timestamp with time zone,
	"approval_reference" text,
	CONSTRAINT "indicator_rule_versions_task_id_code_version_unique" UNIQUE("task_id","code","version"),
	CONSTRAINT "rule_approval_check" CHECK ("indicator_rule_versions"."approval_status" in ('PROPOSED','APPROVED') and ("indicator_rule_versions"."approval_status" <> 'APPROVED' or ("indicator_rule_versions"."approved_at" is not null and "indicator_rule_versions"."approval_reference" is not null)))
);
--> statement-breakpoint
CREATE TABLE "task_launch_grants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"scope" text NOT NULL,
	"submission_id" uuid,
	"secret_digest" text NOT NULL,
	"secret_ciphertext" text NOT NULL,
	"encryption_key_id" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"claimed_at" timestamp with time zone,
	"claim_id" uuid,
	"bound_capability_id" uuid,
	"issued_by_account_id" uuid NOT NULL,
	"request_id" uuid NOT NULL,
	"request_hash" text NOT NULL,
	"invalidated_at" timestamp with time zone,
	CONSTRAINT "task_launch_grants_secret_digest_unique" UNIQUE("secret_digest"),
	CONSTRAINT "task_launch_grants_issued_by_account_id_request_id_unique" UNIQUE("issued_by_account_id","request_id"),
	CONSTRAINT "grant_scope_check" CHECK (("task_launch_grants"."scope" = 'START_SESSION' and "task_launch_grants"."submission_id" is null) or ("task_launch_grants"."scope" = 'RECOVER_SUBMISSION' and "task_launch_grants"."submission_id" is not null))
);
--> statement-breakpoint
CREATE TABLE "task_operation_receipts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_account_id" uuid NOT NULL,
	"request_id" uuid NOT NULL,
	"operation" text NOT NULL,
	"request_hash" text NOT NULL,
	"result_references" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "task_operation_receipts_actor_account_id_request_id_unique" UNIQUE("actor_account_id","request_id")
);
--> statement-breakpoint
CREATE TABLE "raw_events" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "raw_events_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"session_id" uuid NOT NULL,
	"trial_number" integer NOT NULL,
	"stimulus_type" text NOT NULL,
	"spawned_at_ms" double precision NOT NULL,
	"presented_at_ms" double precision,
	"responded_at_ms" double precision,
	"closed_at_ms" double precision NOT NULL,
	"producer_result" text NOT NULL,
	"segment" integer,
	"closure_reason" text NOT NULL,
	"response_window_completed" boolean NOT NULL,
	"response_device" text,
	"geometry" jsonb NOT NULL,
	CONSTRAINT "raw_events_session_id_trial_number_unique" UNIQUE("session_id","trial_number"),
	CONSTRAINT "trial_check" CHECK ("raw_events"."trial_number" > 0 and "raw_events"."spawned_at_ms" >= 0 and "raw_events"."closed_at_ms" >= "raw_events"."spawned_at_ms" and ("raw_events"."presented_at_ms" is null or "raw_events"."presented_at_ms" between "raw_events"."spawned_at_ms" and "raw_events"."closed_at_ms") and ("raw_events"."responded_at_ms" is null or ("raw_events"."presented_at_ms" is not null and "raw_events"."responded_at_ms" between "raw_events"."presented_at_ms" and "raw_events"."closed_at_ms")))
);
--> statement-breakpoint
CREATE TABLE "task_assignment_recipients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assignment_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "task_assignment_recipients_assignment_id_student_id_unique" UNIQUE("assignment_id","student_id"),
	CONSTRAINT "task_assignment_recipients_id_student_id_unique" UNIQUE("id","student_id")
);
--> statement-breakpoint
CREATE TABLE "task_result_receipts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"submission_id" uuid NOT NULL,
	"contract_version" text NOT NULL,
	"evidence_hash" text NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"producer_state" text NOT NULL,
	"termination_reason" text NOT NULL,
	"clock_id" uuid NOT NULL,
	"time_origin_unix_ms" double precision NOT NULL,
	"started_at_ms" double precision NOT NULL,
	"finished_at_ms" double precision NOT NULL,
	"last_checkpoint_at_ms" double precision NOT NULL,
	"device" jsonb NOT NULL,
	CONSTRAINT "task_result_receipts_session_id_unique" UNIQUE("session_id"),
	CONSTRAINT "task_result_receipts_submission_id_unique" UNIQUE("submission_id"),
	CONSTRAINT "receipt_timing_check" CHECK ("task_result_receipts"."started_at_ms" >= 0 and "task_result_receipts"."finished_at_ms" >= "task_result_receipts"."started_at_ms" and "task_result_receipts"."finished_at_ms" = "task_result_receipts"."last_checkpoint_at_ms")
);
--> statement-breakpoint
CREATE TABLE "task_runtime_capabilities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"secret_digest" text NOT NULL,
	"claim_id" uuid NOT NULL,
	"can_start" boolean NOT NULL,
	"can_submit" boolean NOT NULL,
	"can_read_receipt" boolean NOT NULL,
	"start_allowed_until" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"submission_id" uuid,
	CONSTRAINT "task_runtime_capabilities_secret_digest_unique" UNIQUE("secret_digest")
);
--> statement-breakpoint
CREATE TABLE "task_session_incidents" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "task_session_incidents_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"session_id" uuid NOT NULL,
	"sequence" integer NOT NULL,
	"type" text NOT NULL,
	"clock_id" uuid,
	"at_ms" double precision,
	"ended_at_ms" double precision,
	"recorded_at_client" text,
	"category" text NOT NULL,
	CONSTRAINT "task_session_incidents_session_id_sequence_unique" UNIQUE("session_id","sequence"),
	CONSTRAINT "incident_sequence_check" CHECK ("task_session_incidents"."sequence" > 0)
);
--> statement-breakpoint
ALTER TABLE "task_published_versions" ADD CONSTRAINT "task_published_versions_task_unique" UNIQUE("id","task_id");--> statement-breakpoint
ALTER TABLE "task_assignments" ADD CONSTRAINT "task_assignments_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_assignments" ADD CONSTRAINT "task_assignments_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_assignments" ADD CONSTRAINT "task_assignments_created_by_account_id_user_accounts_id_fk" FOREIGN KEY ("created_by_account_id") REFERENCES "public"."user_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_assignments" ADD CONSTRAINT "task_assignments_cancelled_by_user_accounts_id_fk" FOREIGN KEY ("cancelled_by") REFERENCES "public"."user_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_assignments" ADD CONSTRAINT "task_assignments_published_version_id_task_id_task_published_versions_id_task_id_fk" FOREIGN KEY ("published_version_id","task_id") REFERENCES "public"."task_published_versions"("id","task_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calculated_indicators" ADD CONSTRAINT "calculated_indicators_run_id_indicator_calculation_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."indicator_calculation_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "indicator_calculation_runs" ADD CONSTRAINT "indicator_calculation_runs_session_id_task_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."task_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "indicator_calculation_runs" ADD CONSTRAINT "indicator_calculation_runs_rule_version_id_indicator_rule_versions_id_fk" FOREIGN KEY ("rule_version_id") REFERENCES "public"."indicator_rule_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_version_configurations" ADD CONSTRAINT "task_version_configurations_published_version_id_task_published_versions_id_fk" FOREIGN KEY ("published_version_id") REFERENCES "public"."task_published_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_version_configurations" ADD CONSTRAINT "task_version_configurations_rule_version_id_indicator_rule_versions_id_fk" FOREIGN KEY ("rule_version_id") REFERENCES "public"."indicator_rule_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_sessions" ADD CONSTRAINT "task_sessions_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_sessions" ADD CONSTRAINT "task_sessions_group_id_at_start_groups_id_fk" FOREIGN KEY ("group_id_at_start") REFERENCES "public"."groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_sessions" ADD CONSTRAINT "task_sessions_recipient_id_student_id_task_assignment_recipients_id_student_id_fk" FOREIGN KEY ("recipient_id","student_id") REFERENCES "public"."task_assignment_recipients"("id","student_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "indicator_rule_versions" ADD CONSTRAINT "indicator_rule_versions_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_launch_grants" ADD CONSTRAINT "task_launch_grants_session_id_task_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."task_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_launch_grants" ADD CONSTRAINT "task_launch_grants_bound_capability_id_task_runtime_capabilities_id_fk" FOREIGN KEY ("bound_capability_id") REFERENCES "public"."task_runtime_capabilities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_launch_grants" ADD CONSTRAINT "task_launch_grants_issued_by_account_id_user_accounts_id_fk" FOREIGN KEY ("issued_by_account_id") REFERENCES "public"."user_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_operation_receipts" ADD CONSTRAINT "task_operation_receipts_actor_account_id_user_accounts_id_fk" FOREIGN KEY ("actor_account_id") REFERENCES "public"."user_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raw_events" ADD CONSTRAINT "raw_events_session_id_task_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."task_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_assignment_recipients" ADD CONSTRAINT "task_assignment_recipients_assignment_id_task_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."task_assignments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_assignment_recipients" ADD CONSTRAINT "task_assignment_recipients_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_result_receipts" ADD CONSTRAINT "task_result_receipts_session_id_task_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."task_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_runtime_capabilities" ADD CONSTRAINT "task_runtime_capabilities_session_id_task_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."task_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_session_incidents" ADD CONSTRAINT "task_session_incidents_session_id_task_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."task_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "task_assignments_group_id_created_at_id_index" ON "task_assignments" USING btree ("group_id","created_at","id");--> statement-breakpoint
CREATE INDEX "indicator_calculation_runs_status_next_attempt_at_index" ON "indicator_calculation_runs" USING btree ("status","next_attempt_at");--> statement-breakpoint
CREATE UNIQUE INDEX "one_successful_evidence_rule" ON "indicator_calculation_runs" USING btree ("session_id","rule_version_id","evidence_hash") WHERE "indicator_calculation_runs"."status" = 'SUCCEEDED';--> statement-breakpoint
CREATE INDEX "task_sessions_student_id_prepared_at_id_index" ON "task_sessions" USING btree ("student_id","prepared_at","id");--> statement-breakpoint
CREATE UNIQUE INDEX "one_active_game_session" ON "task_sessions" USING btree ("student_id","task_id") WHERE "task_sessions"."execution_status" in ('READY','RUNNING');--> statement-breakpoint
CREATE INDEX "task_assignment_recipients_student_id_index" ON "task_assignment_recipients" USING btree ("student_id");--> statement-breakpoint
ALTER TABLE "task_sessions" ADD CONSTRAINT "task_sessions_active_run_fk" FOREIGN KEY ("active_calculation_run_id") REFERENCES "indicator_calculation_runs"("id");
--> statement-breakpoint
CREATE FUNCTION prevent_game_evidence_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Immutable game evidence/configuration'; END;
$$;
--> statement-breakpoint
CREATE TRIGGER immutable_game_configuration BEFORE UPDATE OR DELETE ON task_version_configurations FOR EACH ROW EXECUTE FUNCTION prevent_game_evidence_mutation();
--> statement-breakpoint
CREATE TRIGGER immutable_game_receipt BEFORE UPDATE OR DELETE ON task_result_receipts FOR EACH ROW EXECUTE FUNCTION prevent_game_evidence_mutation();
--> statement-breakpoint
CREATE TRIGGER immutable_game_events BEFORE UPDATE OR DELETE ON raw_events FOR EACH ROW EXECUTE FUNCTION prevent_game_evidence_mutation();
--> statement-breakpoint
CREATE TRIGGER immutable_game_incidents BEFORE UPDATE OR DELETE ON task_session_incidents FOR EACH ROW EXECUTE FUNCTION prevent_game_evidence_mutation();
--> statement-breakpoint
CREATE TRIGGER immutable_game_recipients BEFORE UPDATE OR DELETE ON task_assignment_recipients FOR EACH ROW EXECUTE FUNCTION prevent_game_evidence_mutation();
--> statement-breakpoint
CREATE FUNCTION protect_game_history() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_TABLE_NAME = 'task_assignments' THEN
    IF (to_jsonb(NEW) - ARRAY['status','cancelled_at','cancelled_by']) IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['status','cancelled_at','cancelled_by']) THEN
      RAISE EXCEPTION 'Immutable assignment conditions';
    END IF;
  ELSIF OLD.approval_status = 'APPROVED' THEN
    RAISE EXCEPTION 'Immutable approved methodology';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER immutable_assignment_conditions BEFORE UPDATE ON task_assignments FOR EACH ROW EXECUTE FUNCTION protect_game_history();
--> statement-breakpoint
CREATE TRIGGER immutable_approved_method BEFORE UPDATE ON indicator_rule_versions FOR EACH ROW EXECUTE FUNCTION protect_game_history();
