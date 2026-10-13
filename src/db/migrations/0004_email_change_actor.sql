ALTER TABLE "account_email_changes" ADD COLUMN "requested_by_auth_user_id" text;--> statement-breakpoint
ALTER TABLE "account_email_changes" ADD CONSTRAINT "account_email_changes_requested_by_auth_user_id_user_id_fk" FOREIGN KEY ("requested_by_auth_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
