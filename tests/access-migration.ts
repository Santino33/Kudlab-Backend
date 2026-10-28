// Empty, explicitly named synthetic database only. Preserves real J-02-shaped history; never truncates.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { assertTestDatabase } from '../src/modules/academico/shared/participation.js';
assertTestDatabase();
const client = new pg.Client({ connectionString: process.env.DATABASE_URL }); await client.connect();
try {
  assert.equal((await client.query("select count(*)::int n from information_schema.tables where table_schema='public'")).rows[0].n, 0, 'EMPTY_DATABASE_REQUIRED');
  const dir = new URL('../src/db/migrations/', import.meta.url), journal = JSON.parse(await readFile(new URL('meta/_journal.json', dir), 'utf8'));
  const apply = async (tag: string) => { await client.query('BEGIN'); try { await client.query(await readFile(new URL(`${tag}.sql`, dir), 'utf8')); await client.query('COMMIT'); } catch (error) { await client.query('ROLLBACK'); throw error; } };
  for (const entry of journal.entries.filter((e: { idx: number }) => e.idx <= 11)) await apply(entry.tag);
  const ids = Array.from({ length: 8 }, () => crypto.randomUUID()), [account, group, student, version, assignment, recipient, ready, finished] = ids;
  await client.query("insert into user_accounts(id,role,email_normalized,full_name,status) values($1,'TEACHER','j03-migration@pilot.edu.co','Docente Sintético','PENDIENTE')", [account]);
  await client.query("insert into groups(id,teacher_id,name,grade,school_year) values($1,$2,'Curso sintético','3',2026)", [group, account]);
  await client.query("insert into students(id,group_id,student_code,first_name,last_name) values($1,$2,'MIG-J03','Participante','Sintético')", [student, group]);
  await client.query("insert into task_published_versions(id,task_id,version) values($1,'TG-01',1)", [version]);
  await client.query("insert into task_assignments(id,task_id,published_version_id,group_id,created_by_account_id,starts_at,ends_at,max_attempts,creation_request_id,request_hash) values($1,'TG-01',$2,$3,$4,now()-interval '1 hour',now()+interval '1 day',3,$5,'synthetic')", [assignment, version, group, account, crypto.randomUUID()]);
  await client.query('insert into task_assignment_recipients(id,assignment_id,student_id) values($1,$2,$3)', [recipient, assignment, student]);
  await client.query("insert into task_sessions(id,recipient_id,student_id,task_id,start_allowed_until) values($1,$2,$3,'TG-01',now()+interval '15 minutes')", [ready, recipient, student]);
  await client.query("insert into task_sessions(id,recipient_id,student_id,task_id,start_allowed_until,attempt_number,execution_status,started_at_server,start_request_id,upload_allowed_until,group_id_at_start,participation_authorization_ref) values($1,$2,$3,'TG-01',now(),1,'INTERRUPTED',now(),$4,now()+interval '7 days',$5,'SYNTHETIC-MIGRATION')", [finished, recipient, student, crypto.randomUUID(), group]);
  await client.query("insert into task_result_receipts(session_id,submission_id,contract_version,evidence_hash,producer_state,termination_reason,clock_id,time_origin_unix_ms,started_at_ms,finished_at_ms,last_checkpoint_at_ms,device) values($1,$2,'1.1',$3,'interrupted','user_exit',$4,0,0,100,100,'{}')", [finished, crypto.randomUUID(), 'a'.repeat(64), crypto.randomUUID()]);
  const tables = ['user_accounts', 'groups', 'students', 'task_assignments', 'task_assignment_recipients', 'task_sessions', 'task_result_receipts'];
  const snapshot = async () => Promise.all(tables.map(async table => (await client.query(`select to_jsonb(t) - 'source_access_code_id' as row from ${table} t order by id`)).rows));
  const before = await snapshot(); for (const entry of journal.entries.filter((e: { idx: number }) => e.idx > 11)) await apply(entry.tag);
  assert.deepEqual(await snapshot(), before);
  assert.equal((await client.query('select count(*)::int n from task_access_codes')).rows[0].n, 0);
  await assert.rejects(client.query("update task_sessions set launch_mode='CODE' where id=$1", [ready]));
  await assert.rejects(client.query("update task_result_receipts set evidence_hash=$1 where session_id=$2", ['b'.repeat(64), finished]));
  console.log(JSON.stringify({ event: 'j03_migration_verified', historicalSessionsAndReceiptUnchanged: true, invalidProvenanceAndEvidenceMutationBlocked: true }));
} finally { await client.end(); }
