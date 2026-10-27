// Only a disposable local preview database, never the tests fallback or a shared database.
if (process.env.NODE_ENV !== 'test' || !process.env.DATABASE_URL || new URL(process.env.DATABASE_URL).pathname !== '/kudlab_cursos_preview')
  throw new Error('Cursos preview requires its explicit isolated database');
const { academicFixture, request, reset } = await import('./helpers.js');
const { db } = await import('../src/db/client.js');
const { students } = await import('../src/db/schema/academic.js');
await reset();
const { a, b, aGroups, bGroups } = await academicFixture();
await request(`/api/v1/accounts/${a.account.id}`, 'PATCH', { name: 'Profesora de demostración A' }, a.admin);
await request(`/api/v1/accounts/${b.account.id}`, 'PATCH', { name: 'Profesor de demostración B' }, a.admin);
for (const [index, group] of [...aGroups, ...bGroups].entries())
  await request(`/api/v1/groups/${group.id}`, 'PATCH', { name: ['Tercero A · Jornada mañana', 'Tercero B · Jornada tarde', 'Cuarto A · Jornada mañana', 'Cuarto B · Jornada tarde'][index] }, a.admin);
await db.insert(students).values({ groupId: aGroups[0]!.id, studentCode: 'DEMO-0001', firstName: 'Estudiante ficticio', lastName: 'De demostración', isActive: true });
console.log('Preview isolated: two synthetic teachers, four courses and one fictitious student. No real email.');
process.exit(0);
