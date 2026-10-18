import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { userAccounts } from '../db/schema/accounts.js';
import { user } from '../db/schema/auth.js';
import { hasActiveIdentity } from '../modules/usuarios/accounts.types.js';

export async function resolveActiveIdentity(authUserId: string) {
  const [account] = await db.select().from(userAccounts).where(eq(userAccounts.authUserId, authUserId)).limit(1);
  const [identity] = await db.select({ id: user.id, email: user.email, name: user.name,
    role: user.role, banned: user.banned }).from(user).where(eq(user.id, authUserId)).limit(1);
  if (!identity || !hasActiveIdentity(account, identity) || account.emailNormalized !== identity.email.toLowerCase()) return null;
  return { account, identity };
}
