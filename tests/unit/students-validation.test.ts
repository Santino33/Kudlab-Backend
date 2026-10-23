import { expect, it } from 'vitest';
import { parseStudentCreate, parseStudentPatch } from '../../src/modules/academico/students/students.validation.js';

const valid = { groupId: '7f839162-c71a-4b17-8e1f-2463c628a40b', studentCode: ' 0001-A ', firstName: ' María ', lastName: ' Pérez ' };
it('PATCH acepta solo correcciones no vacías y rechaza estado, grupo e identidad', () => {
  expect(parseStudentPatch({ firstName: ' María ' })).toEqual({ firstName: 'María' });
  for (const bad of [{}, null, { firstName: '' }, { lastName: 'x'.repeat(101) }, { studentCode: 'x'.repeat(51) },
    { isActive: false }, { groupId: valid.groupId }, { id: valid.groupId }, { teacherId: 'other' }])
    expect(() => parseStudentPatch(bad)).toThrow();
});
it('normaliza extremos sin cambiar caso, acentos o ceros', () => {
  expect(parseStudentCreate(valid)).toEqual({ ...valid, studentCode: '0001-A', firstName: 'María', lastName: 'Pérez' });
});
it('cuenta puntos de código Unicode y rechaza fuera de límites', () => {
  expect(parseStudentCreate({ ...valid, studentCode: '😀'.repeat(50), firstName: '😀'.repeat(100) }).studentCode).toHaveLength(100);
  for (const bad of [{ studentCode: 'a'.repeat(51) }, { firstName: 'a'.repeat(101) }, { lastName: 'a'.repeat(101) },
    { studentCode: '' }, { firstName: '  ' }, { lastName: null }, { studentCode: 1 }])
    expect(() => parseStudentCreate({ ...valid, ...bad })).toThrow();
});
it('rechaza claves ajenas y estado incluso false', () => {
  for (const key of ['id', 'teacherId', 'isActive', 'password']) expect(() => parseStudentCreate({ ...valid, [key]: false })).toThrow();
});
