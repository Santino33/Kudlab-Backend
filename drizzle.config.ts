import { defineConfig } from 'drizzle-kit';

const migrationUrl = process.env.MIGRATION_DATABASE_URL ?? process.env.DATABASE_URL;
if (!migrationUrl) throw new Error('MIGRATION_DATABASE_URL o DATABASE_URL es obligatorio para migraciones');

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema/*.ts',
  out: './src/db/migrations',
  dbCredentials: { url: migrationUrl },
});
