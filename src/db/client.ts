import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { loadEnv } from '../config/env.js';
import * as authSchema from './schema/auth.js';
import * as accountSchema from './schema/accounts.js';
import * as authenticationSchema from './schema/authentication.js';

export const pool = new pg.Pool({ connectionString: loadEnv().DATABASE_URL });
export const db = drizzle(pool, { schema: { ...authSchema, ...accountSchema, ...authenticationSchema } });
