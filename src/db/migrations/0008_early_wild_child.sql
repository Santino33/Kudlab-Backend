CREATE TABLE "groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"teacher_id" uuid NOT NULL,
	"name" varchar(50) NOT NULL,
	"grade" varchar(20) NOT NULL,
	"school_year" integer NOT NULL,
	CONSTRAINT "groups_name_check" CHECK ("groups"."name" <> '' and "groups"."name" = btrim("groups"."name")),
	CONSTRAINT "groups_grade_check" CHECK ("groups"."grade" <> '' and "groups"."grade" = btrim("groups"."grade"))
);
--> statement-breakpoint
CREATE TABLE "students" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"student_code" varchar(50) COLLATE "C" NOT NULL,
	"first_name" varchar(100) NOT NULL,
	"last_name" varchar(100) NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	CONSTRAINT "students_code_unique" UNIQUE("student_code"),
	CONSTRAINT "students_code_check" CHECK ("students"."student_code" <> '' and "students"."student_code" = btrim("students"."student_code")),
	CONSTRAINT "students_first_name_check" CHECK ("students"."first_name" <> '' and "students"."first_name" = btrim("students"."first_name")),
	CONSTRAINT "students_last_name_check" CHECK ("students"."last_name" <> '' and "students"."last_name" = btrim("students"."last_name"))
);
--> statement-breakpoint
ALTER TABLE "groups" ADD CONSTRAINT "groups_teacher_id_user_accounts_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."user_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "groups_teacher_idx" ON "groups" USING btree ("teacher_id");--> statement-breakpoint
CREATE INDEX "students_group_idx" ON "students" USING btree ("group_id");