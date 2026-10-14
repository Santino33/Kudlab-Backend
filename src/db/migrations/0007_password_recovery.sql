CREATE TABLE "password_recovery_verifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"email_normalized" text NOT NULL,
	"token_digest" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"invalidated_at" timestamp with time zone,
	CONSTRAINT "password_recovery_verifications_token_digest_unique" UNIQUE("token_digest"),
	CONSTRAINT "password_recovery_ttl_check" CHECK ("password_recovery_verifications"."expires_at" = "password_recovery_verifications"."created_at" + interval '30 minutes'),
	CONSTRAINT "password_recovery_state_check" CHECK ("password_recovery_verifications"."consumed_at" is null or "password_recovery_verifications"."invalidated_at" is null)
);
--> statement-breakpoint
ALTER TABLE "password_recovery_verifications" ADD CONSTRAINT "password_recovery_verifications_account_id_user_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."user_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "password_recovery_account_created_idx" ON "password_recovery_verifications" USING btree ("account_id","created_at");
