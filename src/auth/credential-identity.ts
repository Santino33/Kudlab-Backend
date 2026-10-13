import { hashPassword } from 'better-auth/crypto';
import { db } from '../db/client.js';
import { user, account as credentials } from '../db/schema/auth.js';
import { passwordSchema } from '../modules/usuarios/accounts.validation.js';

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export function hashCredentialPassword(password: string) {
  return hashPassword(passwordSchema.parse(password));
}

// Better Auth's public createUser API does not join the caller's transaction.
// Keep the initial identity, credential and Kudlab audit in one PostgreSQL transaction.
export async function createBootstrapCredential(tx: Transaction, input: { name: string; email: string; password: string }) {
  const id = crypto.randomUUID();
  const passwordHash = await hashCredentialPassword(input.password);
  await tx.insert(user).values({ id, email: input.email, name: input.name, role: 'admin', emailVerified: true });
  await tx.insert(credentials).values({ id: crypto.randomUUID(), accountId: id, providerId: 'credential',
    userId: id, password: passwordHash });
  return id;
}
