CREATE INDEX "invitation_latest_account_idx" ON "account_invitations" USING btree ("account_id","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);
