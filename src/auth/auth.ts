import { betterAuth } from 'better-auth';
import { hashPassword, verifyPassword } from 'better-auth/crypto';
import { drizzleAdapter } from '@better-auth/drizzle-adapter';
import { admin, bearer, jwt } from 'better-auth/plugins';
import { createAccessControl } from 'better-auth/plugins/access';
import { defaultStatements, adminAc } from 'better-auth/plugins/admin/access';
import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import * as schema from '../db/schema/auth.js';
import { userAccounts } from '../db/schema/accounts.js';
import { loadEnv } from '../config/env.js';
import { passwordSchema } from '../modules/usuarios/accounts.validation.js';

const env = loadEnv();
const ac = createAccessControl(defaultStatements);
const adminRole = ac.newRole(adminAc.statements);
const teacher = ac.newRole({ user: [], session: [] });

export const auth = betterAuth({
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  trustedOrigins: [env.SPA_ORIGIN],
  database: drizzleAdapter(db, { provider: 'pg', schema }),
  emailAndPassword: {
    enabled: true, disableSignUp: true, minPasswordLength: 8, maxPasswordLength: 128,
    password: {
      hash: async (password) => hashPassword(passwordSchema.parse(password)),
      verify: verifyPassword,
    },
  },
  session: { expiresIn: 1800, updateAge: 60 },
  // 1.7.7 databaseHooks.session.create.before runs before a session is persisted.
  // This closes the direct sign-in path for pending/inactive users (also ban them at the plugin).
  databaseHooks: {
    session: { create: { before: async (candidate) => {
      const [account] = await db.select().from(userAccounts).where(eq(userAccounts.authUserId, candidate.userId)).limit(1);
      if (!account || account.status !== 'ACTIVA') return false;
      const [identity] = await db.select({ role: schema.user.role, banned: schema.user.banned }).from(schema.user).where(eq(schema.user.id, candidate.userId));
      if (identity?.banned || identity?.role !== account.role.toLowerCase()) return false;
      return { data: candidate };
    } } },
  },
  plugins: [admin({ ac, roles: { admin: adminRole, teacher }, defaultRole: 'teacher' }), bearer(), jwt()],
});
