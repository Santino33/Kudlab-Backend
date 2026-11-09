CREATE TABLE "consent_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"record_id" uuid NOT NULL,
	"previous_record_id" uuid,
	"type" text NOT NULL,
	"actor_id" uuid NOT NULL,
	"actor_name" text NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reason" text,
	CONSTRAINT "consent_events_student_version_unique" UNIQUE("student_id","version"),
	CONSTRAINT "consent_events_student_id_unique" UNIQUE("student_id","id"),
	CONSTRAINT "consent_events_version_check" CHECK ("consent_events"."version" > 0),
	CONSTRAINT "consent_events_actor_check" CHECK (btrim("consent_events"."actor_name") <> ''),
	CONSTRAINT "consent_events_shape_check" CHECK (("consent_events"."type" = 'REGISTER' and "consent_events"."previous_record_id" is null and "consent_events"."reason" is null)
    or ("consent_events"."type" = 'REPLACE' and "consent_events"."previous_record_id" is not null and "consent_events"."previous_record_id" <> "consent_events"."record_id" and "consent_events"."reason" is null)
    or ("consent_events"."type" = 'REVOKE' and "consent_events"."previous_record_id" is null and "consent_events"."reason" is not null and btrim("consent_events"."reason") <> '' and length("consent_events"."reason") <= 2000))
);
--> statement-breakpoint
CREATE TABLE "consent_operations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"actor_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"action" text NOT NULL,
	"expected_version" integer NOT NULL,
	"fingerprint" text NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"record_id" uuid NOT NULL,
	"object_key" text,
	"signed_on" date,
	"received_on" date,
	"media_type" text,
	"byte_size" integer,
	"sha256" text,
	"reason" text,
	"event_id" uuid,
	"rejection_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "consent_operations_actor_request_unique" UNIQUE("actor_id","request_id"),
	CONSTRAINT "consent_operations_version_check" CHECK ("consent_operations"."expected_version" >= 0),
	CONSTRAINT "consent_operations_hash_check" CHECK ("consent_operations"."fingerprint" ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "consent_operations_state_check" CHECK (("consent_operations"."status" = 'PENDING' and "consent_operations"."event_id" is null and "consent_operations"."rejection_code" is null)
    or ("consent_operations"."status" = 'COMMITTED' and "consent_operations"."event_id" is not null and "consent_operations"."rejection_code" is null)
    or ("consent_operations"."status" = 'REJECTED' and "consent_operations"."event_id" is null and "consent_operations"."rejection_code" is not null)),
	CONSTRAINT "consent_operations_payload_check" CHECK (("consent_operations"."action" = 'REGISTER' and "consent_operations"."object_key" is not null and "consent_operations"."object_key" = 'consents/' || "consent_operations"."record_id"::text
    and "consent_operations"."signed_on" is not null and "consent_operations"."received_on" is not null and "consent_operations"."signed_on" <= "consent_operations"."received_on"
    and "consent_operations"."media_type" is not null and "consent_operations"."media_type" in ('application/pdf','image/jpeg','image/png')
    and "consent_operations"."byte_size" is not null and "consent_operations"."byte_size" between 1 and 10485760
    and "consent_operations"."sha256" is not null and "consent_operations"."sha256" ~ '^[a-f0-9]{64}$' and "consent_operations"."reason" is null)
    or ("consent_operations"."action" = 'REVOKE' and "consent_operations"."object_key" is null and "consent_operations"."signed_on" is null and "consent_operations"."received_on" is null
    and "consent_operations"."media_type" is null and "consent_operations"."byte_size" is null and "consent_operations"."sha256" is null
    and "consent_operations"."reason" is not null and btrim("consent_operations"."reason") <> '' and length("consent_operations"."reason") <= 2000))
);
--> statement-breakpoint
CREATE TABLE "consent_records" (
	"id" uuid PRIMARY KEY NOT NULL,
	"student_id" uuid NOT NULL,
	"signed_on" date NOT NULL,
	"received_on" date NOT NULL,
	"object_key" text NOT NULL,
	"media_type" text NOT NULL,
	"byte_size" integer NOT NULL,
	"sha256" text NOT NULL,
	CONSTRAINT "consent_records_object_key_unique" UNIQUE("object_key"),
	CONSTRAINT "consent_records_student_id_unique" UNIQUE("student_id","id"),
	CONSTRAINT "consent_records_dates_check" CHECK ("consent_records"."signed_on" <= "consent_records"."received_on"),
	CONSTRAINT "consent_records_size_check" CHECK ("consent_records"."byte_size" between 1 and 10485760),
	CONSTRAINT "consent_records_type_check" CHECK ("consent_records"."media_type" in ('application/pdf','image/jpeg','image/png')),
	CONSTRAINT "consent_records_hash_check" CHECK ("consent_records"."sha256" ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "consent_records_key_check" CHECK ("consent_records"."object_key" = 'consents/' || "consent_records"."id"::text)
);
--> statement-breakpoint
ALTER TABLE "consent_events" ADD CONSTRAINT "consent_events_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consent_events" ADD CONSTRAINT "consent_events_actor_id_user_accounts_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consent_events" ADD CONSTRAINT "consent_events_record_fk" FOREIGN KEY ("student_id","record_id") REFERENCES "public"."consent_records"("student_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consent_events" ADD CONSTRAINT "consent_events_previous_fk" FOREIGN KEY ("student_id","previous_record_id") REFERENCES "public"."consent_records"("student_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consent_operations" ADD CONSTRAINT "consent_operations_actor_id_user_accounts_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consent_operations" ADD CONSTRAINT "consent_operations_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consent_operations" ADD CONSTRAINT "consent_operations_event_fk" FOREIGN KEY ("student_id","event_id") REFERENCES "public"."consent_events"("student_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "consent_events_history_idx" ON "consent_events" USING btree ("student_id","version" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "consent_operations_student_idx" ON "consent_operations" USING btree ("student_id");--> statement-breakpoint
-- Drizzle snapshots do not represent triggers. Preserve confirmed evidence and history.
CREATE FUNCTION consent_reject_history_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Consent history is immutable' USING ERRCODE = '23514';
END;
$$;--> statement-breakpoint
CREATE TRIGGER consent_records_immutable BEFORE UPDATE OR DELETE ON consent_records
FOR EACH ROW EXECUTE FUNCTION consent_reject_history_mutation();--> statement-breakpoint
CREATE TRIGGER consent_events_immutable BEFORE UPDATE OR DELETE ON consent_events
FOR EACH ROW EXECUTE FUNCTION consent_reject_history_mutation();
