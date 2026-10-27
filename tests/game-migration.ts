// Runs only against an explicitly empty, named synthetic database. No truncation/drop.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { assertTestDatabase } from '../src/modules/academico/shared/participation.js';
assertTestDatabase();
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  assert.equal((await client.query("select count(*)::int n from information_schema.tables where table_schema='public'")).rows[0].n, 0, 'EMPTY_DATABASE_REQUIRED');
  const dir = new URL('../src/db/migrations/', import.meta.url);
  const journal = JSON.parse(await readFile(new URL('meta/_journal.json', dir), 'utf8')) as { entries: { idx: number; tag: string }[] };
  async function apply(tag: string) {
    await client.query('BEGIN');
    try { await client.query(await readFile(new URL(tag + '.sql', dir), 'utf8')); await client.query('COMMIT'); }
    catch (error) { await client.query('ROLLBACK'); throw error; }
  }
  for (const entry of journal.entries.filter(e => e.idx <= 9)) await apply(entry.tag);
  const accountId = crypto.randomUUID(), groupId = crypto.randomUUID(), studentId = crypto.randomUUID(), versionId = crypto.randomUUID();
  await client.query("insert into user_accounts(id,role,email_normalized,full_name,status) values($1,'TEACHER','migration@pilot.edu.co','Docente Sintético','PENDIENTE')", [accountId]);
  await client.query("insert into groups(id,teacher_id,name,grade,school_year) values($1,$2,'Curso sintético','3',2026)", [groupId, accountId]);
  await client.query("insert into students(id,group_id,student_code,first_name,last_name) values($1,$2,'MIG-J02','Participante','Sintético')", [studentId, groupId]);
  await client.query("insert into task_published_versions(id,task_id,version) values($1,'TG-01',1)", [versionId]);
  const snapshot = async () => Promise.all(['user_accounts', 'groups', 'students', 'tasks', 'task_published_versions'].map(async table => (await client.query(`select * from ${table} order by id`)).rows));
  const before = await snapshot();
  for (const entry of journal.entries.filter(e => e.idx > 9)) await apply(entry.tag);
  assert.deepEqual(await snapshot(), before);
  assert.equal((await client.query('select count(*)::int n from task_version_configurations')).rows[0].n, 0);
  assert.equal((await client.query('select count(*)::int n from task_assignments')).rows[0].n, 0);
  console.log(JSON.stringify({ event: 'j02_migration_verified', previousEntitiesUnchanged: true, unconfiguredVersionsRemainUnconfigured: true }));
} finally { await client.end(); }
