import { sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { userAccounts } from '../db/schema/accounts.js';
import { loadEnv } from '../config/env.js';
import { institutionalEmail, nameSchema } from '../modules/usuarios/shared/accounts.validation.js';
import { recordAudit } from '../modules/usuarios/shared/audit.service.js';
import { createBootstrapCredential } from '../auth/credential-identity.js';

export async function bootstrapAdmin() {
  // A database advisory lock serializes simultaneous service starts, not just restarts.
  await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(713611031)`);
    const [existing] = await tx.select({ id: userAccounts.id }).from(userAccounts).limit(1);
    if (existing) return;
    const env = loadEnv();
    const name = nameSchema.parse(env.BOOTSTRAP_ADMIN_NAME);
    const email = institutionalEmail.parse(env.BOOTSTRAP_ADMIN_EMAIL);
    const id = await createBootstrapCredential(tx, { email, name, password: env.BOOTSTRAP_ADMIN_PASSWORD ?? '' });
    const [account] = await tx.insert(userAccounts).values({ authUserId: id, emailNormalized: email,
      fullName: name, role: 'ADMIN', status: 'ACTIVA' }).returning();
    await recordAudit(tx, account!.id, id, 'BOOTSTRAP_ADMIN', undefined, { role: 'ADMIN', status: 'ACTIVA' });
  });
}
