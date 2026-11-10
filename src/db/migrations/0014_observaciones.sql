CREATE TABLE "teacher_observation_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"observation_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"behavior" text NOT NULL,
	"frequency" text NOT NULL,
	"area" text,
	"observed_on" date NOT NULL,
	"school_year" integer NOT NULL,
	"term" integer NOT NULL,
	"actor_id" uuid NOT NULL,
	"recorded_at" timestamp with time zone NOT NULL,
	"request_id" uuid NOT NULL,
	"fingerprint" text NOT NULL,
	CONSTRAINT "teacher_observation_revisions_version_unique" UNIQUE("observation_id","version"),
	CONSTRAINT "teacher_observation_revisions_request_unique" UNIQUE("actor_id","request_id"),
	CONSTRAINT "teacher_observation_revisions_version_check" CHECK ("teacher_observation_revisions"."version" > 0),
	CONSTRAINT "teacher_observation_revisions_behavior_check" CHECK ("teacher_observation_revisions"."behavior" in ('ATTENTION','FOLLOWING_INSTRUCTIONS')),
	CONSTRAINT "teacher_observation_revisions_frequency_check" CHECK ("teacher_observation_revisions"."frequency" in ('NEVER','SOMETIMES','ALMOST_ALWAYS','ALWAYS')),
	CONSTRAINT "teacher_observation_revisions_area_check" CHECK ("teacher_observation_revisions"."area" is null or "teacher_observation_revisions"."area" in ('LANGUAGE_READING','MATHEMATICS')),
	CONSTRAINT "teacher_observation_revisions_term_check" CHECK ("teacher_observation_revisions"."term" between 1 and 4),
	CONSTRAINT "teacher_observation_revisions_hash_check" CHECK ("teacher_observation_revisions"."fingerprint" ~ '^[a-f0-9]{64}$')
);
--> statement-breakpoint
CREATE TABLE "teacher_observations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "teacher_observations_version_check" CHECK ("teacher_observations"."version" > 0)
);
--> statement-breakpoint
ALTER TABLE "teacher_observation_revisions" ADD CONSTRAINT "teacher_observation_revisions_observation_id_teacher_observations_id_fk" FOREIGN KEY ("observation_id") REFERENCES "public"."teacher_observations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_observation_revisions" ADD CONSTRAINT "teacher_observation_revisions_actor_id_user_accounts_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_observations" ADD CONSTRAINT "teacher_observations_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_observations" ADD CONSTRAINT "teacher_observations_author_id_user_accounts_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."user_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "teacher_observations_history_idx" ON "teacher_observations" USING btree ("student_id","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);
--> statement-breakpoint
-- Revisions are evidence/receipts, never mutable values or expiring deduplication keys.
CREATE FUNCTION observation_revision_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Observation revisions are append-only' USING ERRCODE = '23514';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER observation_revision_immutable BEFORE UPDATE OR DELETE ON teacher_observation_revisions
FOR EACH ROW EXECUTE FUNCTION observation_revision_immutable();
--> statement-breakpoint
CREATE FUNCTION observation_identity_preserved() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Observation identity is permanent' USING ERRCODE = '23514';
  END IF;
  IF ROW(NEW.id, NEW.student_id, NEW.author_id, NEW.created_at) IS DISTINCT FROM
     ROW(OLD.id, OLD.student_id, OLD.author_id, OLD.created_at) OR NEW.version <> OLD.version + 1 THEN
    RAISE EXCEPTION 'Observation provenance is immutable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER observation_identity_preserved BEFORE UPDATE OR DELETE ON teacher_observations
FOR EACH ROW EXECUTE FUNCTION observation_identity_preserved();
