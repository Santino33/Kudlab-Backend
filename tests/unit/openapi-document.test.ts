import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { operations, parseContract, readContract, validateDocument, validateExamples, type Document } from '../openapi.helpers.js';

async function check(doc: Document) {
  await validateDocument(doc);
  await validateExamples(doc);
  const design = readFileSync(new URL('../../specs/006-api-swagger-docs/contracts/documentation.md', import.meta.url), 'utf8');
  const expected = [...design.matchAll(/^\| `([^`]+)` \| (GET|POST|PATCH|PUT|DELETE) `([^`]+)` \|/gm)]
    .map((m) => `${m[2]!.toLowerCase()} ${m[3]} ${m[1]}`).sort();
  expect(expected).toHaveLength(35);
  expect(operations(doc).map(([p, m, o]) => `${m} ${p} ${o.operationId}`).sort()).toEqual(expected);
}

it('valida OpenAPI completo y las 35 operaciones actuales, no solo sintaxis YAML', async () => {
  const doc = readContract();
  expect(doc.openapi).toBe('3.1.0');
  expect(doc.info.version).toBe('0.1.0');
  expect(doc.servers).toEqual([{ url: '/' }]);
  await check(doc);
  expect(doc.tags.map((t: { name: string }) => t.name).sort()).toEqual([
    'Acceso', 'Cuentas', 'Invitaciones', 'CambiosCorreo', 'SolicitudesRol', 'Recuperacion', 'Estudiantes', 'Tareas', 'Cursos',
  ].sort());
});

it('rechaza YAML malformado y claves duplicadas', () => {
  expect(() => parseContract('openapi: [')).toThrow();
  expect(() => parseContract('openapi: 3.1.0\nopenapi: 3.0.0')).toThrow();
});

it.each(['ref-roto', 'ref-externo', 'id-duplicado', 'parametro', 'seguridad', 'operacion-extra', 'operacion-ausente', 'ejemplo'])('detecta mutación: %s', async (kind) => {
  const doc = readContract();
  const login = doc.paths['/api/auth/sign-in/email'].post;
  switch (kind) {
    case 'ref-roto': doc.components.schemas.Name = { $ref: '#/components/schemas/Absent' }; break;
    case 'ref-externo': doc.components.schemas.Name = { $ref: 'https://invalid.example/schema' }; break;
    case 'id-duplicado': login.operationId = 'getSession'; break;
    case 'parametro': delete doc.paths['/api/v1/students/{id}'].parameters; break;
    case 'seguridad': login.security = [{ nonexistent: [] }]; break;
    case 'operacion-extra': doc.paths['/future'] = { get: { ...login, operationId: 'future' } }; break;
    case 'operacion-ausente': delete doc.paths['/api/auth/jwks']; break;
    case 'ejemplo': doc.components.schemas.NewPassword.examples = ['weak']; break;
  }
  await expect(check(doc)).rejects.toThrow();
});

it.each(['schema', 'media', 'parameter', 'header', 'reusable'])('valida ejemplos contextuales de %s', async (place) => {
  const doc = readContract();
  const bad = { schema: { type: 'integer' }, example: 'not-an-integer' };
  switch (place) {
    case 'schema': doc.components.schemas.Name.example = 123; break;
    case 'media': doc.paths['/api/auth/token'].get.responses['200'].content['application/json'].example = { token: 12 }; break;
    case 'parameter': doc.paths['/api/v1/accounts'].get.parameters.push({ name: 'synthetic', in: 'query', ...bad }); break;
    case 'header': doc.components.headers.SessionToken = bad; break;
    case 'reusable':
      doc.components.examples = { Invalid: { value: false } };
      doc.components.headers.SessionToken.examples = { reused: { $ref: '#/components/examples/Invalid' } };
      break;
  }
  await expect(validateExamples(doc)).rejects.toThrow();
});
