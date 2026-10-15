import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { parse } from 'yaml';
import { db } from '../../src/db/client.js';
import { groups, students } from '../../src/db/schema/academic.js';
import { academicAssignments } from '../../src/modules/academico/assignment-provider.js';
import { inviteTeacher, request, reset } from '../helpers.js';

const contract = parse(readFileSync('specs/004-autorizar-rol-ambito/contracts/academic-students.openapi.yaml', 'utf8'));

describe('contrato de listas y opciones académicas', () => {
  beforeEach(reset);

  it('da 401/403 a actores sin permiso, y filtros malformados no alteran ni revelan datos', async () => {
    expect(contract.paths['/api/v1/students'].get.responses['200']).toBeDefined();
    const { account, admin, teacher } = await inviteTeacher();
    const [group] = await db.insert(groups).values({ teacherAccountId: account.id, name: '3A',
      grade: '3', schoolYear: 2026 }).returning();
    await db.insert(students).values({ groupId: group!.id, studentCode: 'scoped', firstName: 'Elena', lastName: 'Prueba' });
    for (const route of ['/api/v1/students', '/api/v1/groups']) {
      const unauth = await request(route, 'GET');
      expect(unauth.status).toBe(401);
      expect(JSON.stringify(await unauth.json())).not.toContain('Elena');
      const forbidden = await request(route, 'GET', undefined, admin);
      expect(forbidden.status).toBe(403);
      expect(JSON.stringify(await forbidden.json())).not.toContain('Elena');
    }
    for (const query of ['?groupId=bad', '?ids=bad', '?limit=0', '?offset=-1']) {
      const invalid = await request(`/api/v1/students${query}`, 'GET', undefined, teacher);
      expect(invalid.status).toBe(400);
      expect(JSON.stringify(await invalid.json())).not.toContain('Elena');
    }
  });

  it('distingue ámbito vacío comprobado de proveedor indisponible sin listar todo', async () => {
    const { teacher } = await inviteTeacher();
    expect(await (await request('/api/v1/students', 'GET', undefined, teacher)).json()).toMatchObject({ items: [], total: 0 });
    const provider = vi.spyOn(academicAssignments, 'ownedGroupIds').mockRejectedValue(new Error('proveedor indisponible'));
    try {
      const denied = await request('/api/v1/students', 'GET', undefined, teacher);
      expect(denied.status).toBe(503);
      expect(await denied.json()).toEqual({ code: 'UNAVAILABLE', message: 'Operación no confirmada' });
    } finally { provider.mockRestore(); }
  });
});
