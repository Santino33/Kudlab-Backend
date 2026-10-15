CREATE TABLE "groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"teacher_account_id" uuid NOT NULL,
	"name" varchar(50) NOT NULL,
	"grade" varchar(20) NOT NULL,
	"school_year" integer NOT NULL,
	CONSTRAINT "group_year_positive" CHECK ("groups"."school_year" > 0)
);
--> statement-breakpoint
CREATE TABLE "students" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"student_code" varchar(50) NOT NULL,
	"first_name" varchar(100) NOT NULL,
	"last_name" varchar(100) NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	CONSTRAINT "students_student_code_unique" UNIQUE("student_code"),
	CONSTRAINT "student_first_name_nonempty" CHECK (length(btrim("students"."first_name")) > 0),
	CONSTRAINT "student_last_name_nonempty" CHECK (length(btrim("students"."last_name")) > 0)
);
--> statement-breakpoint
ALTER TABLE "groups" ADD CONSTRAINT "groups_teacher_account_id_user_accounts_id_fk" FOREIGN KEY ("teacher_account_id") REFERENCES "public"."user_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE no action ON UPDATE no action;