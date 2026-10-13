import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { expect, it } from 'vitest';
import { app } from '../../src/app.js';

it('OpenAPI documenta todas las rutas y respuestas implementadas', () => {
  const spec = parse(readFileSync('specs/001-gestionar-cuentas-roles/contracts/accounts.openapi.yaml', 'utf8'));
  const expected: Record<string, string[]> = {
    '/api/v1/accounts': ['get', 'post'], '/api/v1/accounts/{id}': ['get', 'patch'],
    '/api/v1/accounts/{id}/audit': ['get'], '/api/v1/accounts/{id}/role': ['put'],
    '/api/v1/accounts/{id}/deactivate': ['post'], '/api/v1/accounts/{id}/reactivate': ['post'],
    '/api/v1/admin-role-requests': ['get', 'post'], '/api/v1/admin-role-requests/{id}/approve': ['post'],
    '/api/v1/admin-role-requests/{id}/reject': ['post'], '/api/v1/account-invitations/accept': ['post'],
    '/api/v1/account-email-changes/confirm': ['post'],
  };
  expect(Object.keys(spec.paths).sort()).toEqual(Object.keys(expected).sort());
  const implemented = new Set(app.routes.filter((route) => route.method !== 'ALL' && route.path.startsWith('/api/v1/'))
    .map((route) => `${route.method.toLowerCase()} ${route.path.replace(/:id\b/g, '{id}')}`));
  for (const [path, methods] of Object.entries(expected)) for (const method of methods) {
    expect(implemented.has(`${method} ${path}`), `${method.toUpperCase()} ${path} falta en Hono`).toBe(true);
    const responses = spec.paths[path][method].responses;
    expect(Object.keys(responses).some((code) => code.startsWith('2'))).toBe(true);
    expect(Object.values(responses).every((response) => typeof response === 'object' && response !== null && ('$ref' in response || 'content' in response))).toBe(true);
  }
});
