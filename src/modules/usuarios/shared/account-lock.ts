import { eq } from 'drizzle-orm';
import { db } from '../../../db/client.js';
import { userAccounts } from '../../../db/schema/accounts.js';
import { AccountError } from './accounts.errors.js';

export type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function lockAccount(tx: Transaction, id: string) {
  const [account] = await tx.select().from(userAccounts).where(eq(userAccounts.id, id)).for('update');
  if (!account) throw new AccountError(404, 'NOT_FOUND', 'Cuenta no encontrada');
  return account;
}
