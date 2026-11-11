CREATE TABLE "teacher_annotations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"author_account_id" uuid NOT NULL,
	"text" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	CONSTRAINT "teacher_annotations_text_length" CHECK (char_length("teacher_annotations"."text") between 1 and 1000),
	CONSTRAINT "teacher_annotations_text_nonblank" CHECK ("teacher_annotations"."text" ~ '[^[:space:]   -     　﻿]')
);
--> statement-breakpoint
ALTER TABLE "teacher_annotations" ADD CONSTRAINT "teacher_annotations_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_annotations" ADD CONSTRAINT "teacher_annotations_author_account_id_user_accounts_id_fk" FOREIGN KEY ("author_account_id") REFERENCES "public"."user_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "teacher_annotations_student_date_idx" ON "teacher_annotations" USING btree ("student_id","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);