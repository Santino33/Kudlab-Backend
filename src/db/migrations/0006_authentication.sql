CREATE TABLE "session_activity" (
	"session_id" text PRIMARY KEY NOT NULL,
	"last_accepted_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "session_activity" ADD CONSTRAINT "session_activity_session_id_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."session"("id") ON DELETE cascade ON UPDATE no action;
