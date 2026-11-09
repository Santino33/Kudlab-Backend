-- CA-01/03/05/07/08/09. Run only in the exclusive, migrated consent test database.
\set ON_ERROR_STOP on
BEGIN;
DO $$ BEGIN
  IF current_database() <> 'kudlab_consent_schema_test' THEN RAISE EXCEPTION 'Wrong test database'; END IF;
END $$;
CREATE FUNCTION pg_temp.expect_error(statement text, expected text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE actual text;
BEGIN
  BEGIN EXECUTE statement;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS actual = RETURNED_SQLSTATE;
    IF actual = expected THEN RETURN; END IF;
    RAISE EXCEPTION 'Expected %, got %', expected, actual;
  END;
  RAISE EXCEPTION 'Expected failure %', expected;
END $$;
INSERT INTO user_accounts (id,email_normalized,full_name,role,status)
VALUES ('10000000-0000-4000-8000-000000000001','schema@example.edu.co','Synthetic teacher','TEACHER','PENDIENTE');
INSERT INTO groups (id,teacher_id,name,grade,school_year)
VALUES ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','Synthetic','3',2026);
INSERT INTO students (id,group_id,student_code,first_name,last_name) VALUES
('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','S1','Synthetic','One'),
('30000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001','S2','Synthetic','Two');
INSERT INTO consent_records VALUES
('40000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','2026-11-08','2026-11-09','consents/40000000-0000-4000-8000-000000000001','image/png',10485760,repeat('a',64));
INSERT INTO consent_events (id,student_id,version,record_id,type,actor_id,actor_name) VALUES
('50000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001',1,'40000000-0000-4000-8000-000000000001','REGISTER','10000000-0000-4000-8000-000000000001','Synthetic teacher');
SELECT pg_temp.expect_error($q$INSERT INTO consent_events (student_id,version,record_id,type,actor_id,actor_name)
SELECT student_id,version,record_id,type,actor_id,actor_name FROM consent_events$q$, '23505');
SELECT pg_temp.expect_error($q$INSERT INTO consent_events (student_id,version,record_id,type,actor_id,actor_name)
SELECT '30000000-0000-4000-8000-000000000002',1,record_id,type,actor_id,actor_name FROM consent_events$q$, '23503');
SELECT pg_temp.expect_error($q$UPDATE consent_events SET actor_name = 'changed'$q$, '23514');
SELECT pg_temp.expect_error($q$DELETE FROM consent_events$q$, '23514');
SELECT pg_temp.expect_error($q$UPDATE consent_records SET byte_size = 1$q$, '23514');
SELECT pg_temp.expect_error($q$DELETE FROM consent_records$q$, '23514');
SELECT pg_temp.expect_error($q$DELETE FROM students WHERE student_code = 'S1'$q$, '23503');
SELECT pg_temp.expect_error($q$DELETE FROM user_accounts$q$, '23503');
DO $$
DECLARE expression text;
BEGIN
  FOREACH expression IN ARRAY ARRAY['0','10485761'] LOOP
    PERFORM pg_temp.expect_error(format($q$INSERT INTO consent_records SELECT
      '40000000-0000-4000-8000-000000000002',student_id,signed_on,received_on,
      'consents/40000000-0000-4000-8000-000000000002',media_type,%s,sha256 FROM consent_records$q$, expression),'23514');
  END LOOP;
END $$;
SELECT pg_temp.expect_error($q$INSERT INTO consent_records SELECT
'40000000-0000-4000-8000-000000000002',student_id,received_on,signed_on,
'consents/40000000-0000-4000-8000-000000000002',media_type,byte_size,sha256 FROM consent_records$q$,'23514');
SELECT pg_temp.expect_error($q$INSERT INTO consent_records SELECT
'40000000-0000-4000-8000-000000000002',student_id,signed_on,received_on,
'consents/40000000-0000-4000-8000-000000000002','text/plain',byte_size,sha256 FROM consent_records$q$,'23514');
INSERT INTO consent_operations (request_id,actor_id,student_id,action,expected_version,fingerprint,record_id,reason)
VALUES ('60000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',
'30000000-0000-4000-8000-000000000001','REVOKE',1,repeat('b',64),'40000000-0000-4000-8000-000000000001','Synthetic reason');
SELECT pg_temp.expect_error($q$INSERT INTO consent_operations (request_id,actor_id,student_id,action,expected_version,fingerprint,record_id,reason)
SELECT request_id,actor_id,student_id,action,expected_version,fingerprint,record_id,reason FROM consent_operations$q$, '23505');
SELECT pg_temp.expect_error($q$UPDATE consent_operations SET status = 'COMMITTED'$q$,'23514');
SELECT pg_temp.expect_error($q$UPDATE consent_operations SET student_id = '30000000-0000-4000-8000-000000000002',
status = 'COMMITTED', event_id = '50000000-0000-4000-8000-000000000001'$q$,'23503');
SELECT pg_temp.expect_error($q$UPDATE consent_operations SET reason = ''$q$,'23514');
INSERT INTO consent_events (student_id,version,record_id,type,actor_id,actor_name,reason)
SELECT student_id,2,record_id,'REVOKE',actor_id,actor_name,'Synthetic reason' FROM consent_events;
DO $$ BEGIN
  IF (SELECT count(*) FROM consent_events) <> 2 THEN RAISE EXCEPTION 'History lost'; END IF;
  IF EXISTS (SELECT 1 FROM students WHERE is_active) THEN RAISE EXCEPTION 'Unexpected activation'; END IF;
END $$;
ROLLBACK;
SELECT 'consent schema assertions passed' AS result;
