CREATE TABLE "academic_note_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"note_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"score" numeric(2, 1) NOT NULL,
	"author_id" uuid NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "academic_note_revisions_version_unique" UNIQUE("note_id","version"),
	CONSTRAINT "academic_note_revisions_score_check" CHECK ("academic_note_revisions"."score" between 1.0 and 5.0)
);
--> statement-breakpoint
CREATE TABLE "academic_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"subject" varchar(20) NOT NULL,
	"school_year" integer NOT NULL,
	"term" smallint NOT NULL,
	"score" numeric(2, 1) NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"author_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "academic_notes_slot_unique" UNIQUE("student_id","subject","school_year","term"),
	CONSTRAINT "academic_notes_subject_check" CHECK ("academic_notes"."subject" in ('LENGUAJE', 'MATEMATICAS')),
	CONSTRAINT "academic_notes_term_check" CHECK ("academic_notes"."term" between 1 and 4),
	CONSTRAINT "academic_notes_score_check" CHECK ("academic_notes"."score" between 1.0 and 5.0),
	CONSTRAINT "academic_notes_version_check" CHECK ("academic_notes"."version" >= 1)
);
--> statement-breakpoint
ALTER TABLE "academic_note_revisions" ADD CONSTRAINT "academic_note_revisions_note_id_academic_notes_id_fk" FOREIGN KEY ("note_id") REFERENCES "public"."academic_notes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "academic_note_revisions" ADD CONSTRAINT "academic_note_revisions_author_id_user_accounts_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."user_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "academic_notes" ADD CONSTRAINT "academic_notes_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "academic_notes" ADD CONSTRAINT "academic_notes_author_id_user_accounts_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."user_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "academic_notes_student_idx" ON "academic_notes" USING btree ("student_id");