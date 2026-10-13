import { sql } from 'drizzle-orm';
import { hashPassword } from 'better-auth/crypto';
import { db } from '../db/client.js';
import { userAccounts } from '../db/schema/accounts.js';
import { user, account as credentials } from '../db/schema/auth.js';
import { loadEnv } from '../config/env.js';
import { institutionalEmail, nameSchema, passwordSchema } from '../modules/usuarios/accounts.validation.js';
import { recordAudit } from '../modules/usuarios/audit.service.js';

export async function bootstrapAdmin() {
  // A database advisory lock serializes simultaneous service starts, not just restarts.
  await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(713611031)`);
    const [existing] = await tx.select({ id: userAccounts.id }).from(userAccounts).limit(1);
    if (existing) return;
    const env = loadEnv();
    const name = nameSchema.parse(env.BOOTSTRAP_ADMIN_NAME);
    const email = institutionalEmail.parse(env.BOOTSTRAP_ADMIN_EMAIL);
    const password = passwordSchema.parse(env.BOOTSTRAP_ADMIN_PASSWORD);
    // Better Auth's credential format/algorithm (1.7.7) is reused; all writes share this transaction.
    const id = crypto.randomUUID();
    await tx.insert(user).values({ id, email, name, role: 'admin', emailVerified: true });
    await tx.insert(credentials).values({ id: crypto.randomUUID(), accountId: id, providerId: 'credential',
      userId: id, password: await hashPassword(password) });
    const [account] = await tx.insert(userAccounts).values({ authUserId: id, emailNormalized: email,
      fullName: name, role: 'ADMIN', status: 'ACTIVA' }).returning();
    await recordAudit(tx, account!.id, id, 'BOOTSTRAP_ADMIN', undefined, { role: 'ADMIN', status: 'ACTIVA' });
  });
}
