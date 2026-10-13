CREATE TABLE "admin_role_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"requester_account_id" uuid NOT NULL,
	"status" text DEFAULT 'PENDIENTE' NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_by_account_id" uuid,
	"decided_at" timestamp with time zone,
	CONSTRAINT "request_status_check" CHECK ("admin_role_requests"."status" in ('PENDIENTE','APROBADA','RECHAZADA')),
	CONSTRAINT "decision_check" CHECK (("admin_role_requests"."status" = 'PENDIENTE' and "admin_role_requests"."decided_at" is null and "admin_role_requests"."decided_by_account_id" is null) or ("admin_role_requests"."status" <> 'PENDIENTE' and "admin_role_requests"."decided_at" is not null and "admin_role_requests"."decided_by_account_id" is not null))
);
--> statement-breakpoint
CREATE TABLE "account_audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"target_account_id" uuid NOT NULL,
	"actor_auth_user_id" text NOT NULL,
	"action" text NOT NULL,
	"before" jsonb,
	"after" jsonb,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "account_email_changes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"new_email_normalized" text NOT NULL,
	"token_digest" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"invalidated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "account_email_changes_token_digest_unique" UNIQUE("token_digest")
);
--> statement-breakpoint
CREATE TABLE "account_invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"email_normalized" text NOT NULL,
	"token_digest" text NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"invalidated_at" timestamp with time zone,
	"delivery_status" text DEFAULT 'PENDIENTE' NOT NULL,
	CONSTRAINT "account_invitations_token_digest_unique" UNIQUE("token_digest"),
	CONSTRAINT "invitation_delivery_check" CHECK ("account_invitations"."delivery_status" in ('PENDIENTE','ENVIADA','ERROR')),
	CONSTRAINT "invitation_ttl_check" CHECK ("account_invitations"."expires_at" = "account_invitations"."created_at" + interval '7 days')
);
--> statement-breakpoint
CREATE TABLE "user_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"auth_user_id" text,
	"email_normalized" text NOT NULL,
	"pending_email_normalized" text,
	"full_name" text NOT NULL,
	"role" text NOT NULL,
	"status" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_accounts_auth_user_id_unique" UNIQUE("auth_user_id"),
	CONSTRAINT "user_accounts_email_normalized_unique" UNIQUE("email_normalized"),
	CONSTRAINT "account_role_check" CHECK ("user_accounts"."role" in ('ADMIN','TEACHER')),
	CONSTRAINT "account_status_check" CHECK ("user_accounts"."status" in ('PENDIENTE','ACTIVA','INACTIVA')),
	CONSTRAINT "account_auth_check" CHECK (("user_accounts"."status" = 'PENDIENTE' and "user_accounts"."auth_user_id" is null) or ("user_accounts"."status" <> 'PENDIENTE' and "user_accounts"."auth_user_id" is not null)),
	CONSTRAINT "account_email_check" CHECK ("user_accounts"."email_normalized" = lower("user_accounts"."email_normalized") and "user_accounts"."email_normalized" ~ '^[^@[:space:]]+@([a-z0-9-]+\.)+edu\.co$')
);
--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jwks" (
	"id" text PRIMARY KEY NOT NULL,
	"public_key" text NOT NULL,
	"private_key" text NOT NULL,
	"created_at" timestamp NOT NULL,
	"expires_at" timestamp,
	"alg" text,
	"crv" text
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	"impersonated_by" text,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"role" text,
	"banned" boolean DEFAULT false,
	"ban_reason" text,
	"ban_expires" timestamp,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "admin_role_requests" ADD CONSTRAINT "admin_role_requests_requester_account_id_user_accounts_id_fk" FOREIGN KEY ("requester_account_id") REFERENCES "public"."user_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_role_requests" ADD CONSTRAINT "admin_role_requests_decided_by_account_id_user_accounts_id_fk" FOREIGN KEY ("decided_by_account_id") REFERENCES "public"."user_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_audit_events" ADD CONSTRAINT "account_audit_events_target_account_id_user_accounts_id_fk" FOREIGN KEY ("target_account_id") REFERENCES "public"."user_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_email_changes" ADD CONSTRAINT "account_email_changes_account_id_user_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."user_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_invitations" ADD CONSTRAINT "account_invitations_account_id_user_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."user_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_accounts" ADD CONSTRAINT "user_accounts_auth_user_id_user_id_fk" FOREIGN KEY ("auth_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "one_pending_request" ON "admin_role_requests" USING btree ("requester_account_id") WHERE "admin_role_requests"."status" = 'PENDIENTE';--> statement-breakpoint
CREATE INDEX "audit_account_idx" ON "account_audit_events" USING btree ("target_account_id");--> statement-breakpoint
CREATE INDEX "email_change_account_idx" ON "account_email_changes" USING btree ("account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "account_pending_email_unique" ON "user_accounts" USING btree ("pending_email_normalized");--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");
