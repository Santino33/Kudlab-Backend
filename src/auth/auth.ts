import { betterAuth } from 'better-auth';
import { verifyPassword } from 'better-auth/crypto';
import { drizzleAdapter } from '@better-auth/drizzle-adapter';
import { admin, bearer, jwt } from 'better-auth/plugins';
import { createAccessControl } from 'better-auth/plugins/access';
import { defaultStatements, adminAc } from 'better-auth/plugins/admin/access';
import { db } from '../db/client.js';
import * as schema from '../db/schema/auth.js';
import { loadEnv } from '../config/env.js';
import { hashCredentialPassword } from './credential-identity.js';
import { resolveActiveIdentity } from './active-identity.js';

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
      hash: hashCredentialPassword,
      verify: verifyPassword,
    },
  },
  session: { expiresIn: 1800, updateAge: 60 },
  // 1.7.7 databaseHooks.session.create.before runs before a session is persisted.
  // This closes the direct sign-in path for pending/inactive users (also ban them at the plugin).
  databaseHooks: {
    session: { create: { before: async (candidate) => {
      if (!await resolveActiveIdentity(candidate.userId)) return false;
      return { data: candidate };
    } } },
  },
  plugins: [admin({ ac, roles: { admin: adminRole, teacher }, defaultRole: 'teacher' }), bearer(), jwt()],
});
