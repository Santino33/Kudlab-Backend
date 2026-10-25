import { readFileSync } from 'node:fs';
import { parseDocument } from 'yaml';
import SwaggerParser from '@apidevtools/swagger-parser';
import { Ajv2020 } from 'ajv/dist/2020.js';
import addFormatsModule from 'ajv-formats';
import type { FormatsPlugin } from 'ajv-formats';
import type { OpenAPI } from 'openapi-types';

// The parsed contract is dynamic test data, not a second hand-maintained DTO model.
export type Document = Record<string, any>;
export const contractURL = new URL('../docs/api/openapi.yaml', import.meta.url);
const methods = ['get', 'post', 'put', 'patch', 'delete', 'options', 'head', 'trace'];
const ajv = new Ajv2020({ strict: false, allErrors: true });
(addFormatsModule as unknown as FormatsPlugin)(ajv);

export function readContract(): Document {
  return parseContract(readFileSync(contractURL, 'utf8'));
}
export function parseContract(text: string): Document {
  const parsed = parseDocument(text, { uniqueKeys: true });
  if (parsed.errors.length) throw new Error(parsed.errors.map((e) => e.message).join('\n'));
  return parsed.toJS();
}
export function resolve(doc: Document, value: any): any {
  if (!value?.$ref) return value;
  if (!value.$ref.startsWith('#/')) throw new Error(`Referencia externa prohibida: ${value.$ref}`);
  const target = value.$ref.slice(2).split('/').reduce((v: any, k: string) => v?.[k.replace(/~1/g, '/').replace(/~0/g, '~')], doc);
  if (target === undefined) throw new Error(`Referencia inexistente: ${value.$ref}`);
  return resolve(doc, target);
}
export function operations(doc: Document): [string, string, any][] {
  return Object.entries(doc.paths).flatMap(([path, entry]: [string, any]) =>
    methods.filter((method) => entry[method]).map((method): [string, string, any] => [path, method, entry[method]]));
}
export function assertSchema(doc: Document, schema: any, value: unknown) {
  const check = ajv.compile({ ...schema, components: doc.components });
  if (!check(value)) throw new Error(ajv.errorsText(check.errors, { separator: '\n' }));
}
export async function validateDocument(doc: Document) {
  function refs(value: any) {
    if (!value || typeof value !== 'object') return;
    if (value.$ref) resolve(doc, value);
    for (const [key, child] of Object.entries(value)) if (!['example', 'examples'].includes(key)) refs(child);
  }
  refs(doc);
  await SwaggerParser.validate(structuredClone(doc) as OpenAPI.Document, {
    resolve: { file: false, http: false }, dereference: { circular: false },
  });
  const ids = new Set<string>();
  for (const [path, , op] of operations(doc)) {
    if (!op.operationId || ids.has(op.operationId)) throw new Error('operationId ausente o duplicado');
    ids.add(op.operationId);
    if (!op.summary || !op.description || !op.tags?.length) throw new Error('Metadatos incompletos');
    const parameters = [...(doc.paths[path].parameters ?? []), ...(op.parameters ?? [])].map((p) => resolve(doc, p));
    for (const name of path.matchAll(/\{([^}]+)\}/g))
      if (!parameters.some((p) => p.in === 'path' && p.name === name[1] && p.required)) throw new Error('Parámetro de ruta ausente');
    for (const requirement of op.security ?? doc.security ?? [])
      for (const name of Object.keys(requirement)) if (!doc.components.securitySchemes[name]) throw new Error('Seguridad inexistente');
  }
}
export async function validateExamples(doc: Document) {
  function schemaExamples(schema: any) {
    if (!schema || typeof schema !== 'object') return;
    const actual = resolve(doc, schema);
    // Compile even schemas without examples: this also detects invalid patterns/formats.
    ajv.compile({ ...actual, components: doc.components });
    if ('example' in actual) assertSchema(doc, schema, actual.example);
    for (const example of actual.examples ?? []) assertSchema(doc, schema, example);
    for (const child of Object.values(actual.properties ?? {})) schemaExamples(child);
    for (const child of Object.values(actual.$defs ?? {})) schemaExamples(child);
    for (const key of ['items', 'additionalProperties', 'not', 'if', 'then', 'else', 'contains']) schemaExamples(actual[key]);
    for (const key of ['allOf', 'anyOf', 'oneOf', 'prefixItems']) for (const child of actual[key] ?? []) schemaExamples(child);
  }
  function visit(value: any) {
    if (!value || typeof value !== 'object') return;
    const actual = resolve(doc, value);
    if (actual.schema) {
      schemaExamples(actual.schema);
      if ('example' in actual) assertSchema(doc, actual.schema, actual.example);
      for (const entry of Object.values(actual.examples ?? {})) {
        const example = resolve(doc, entry);
        if ('externalValue' in example) throw new Error('Ejemplo remoto prohibido');
        if ('value' in example) assertSchema(doc, actual.schema, example.value);
      }
    }
    for (const [key, child] of Object.entries(actual))
      if (!['schema', 'example', 'examples'].includes(key)) visit(child);
  }
  for (const schema of Object.values(doc.components.schemas)) schemaExamples(schema);
  visit(doc.paths);
  visit(doc.components.headers);
  visit(doc.components.parameters);
  visit(doc.components.responses);
  visit(doc.components.requestBodies);
}
export async function assertResponse(doc: Document, path: string, method: string, response: Response) {
  const declared = doc.paths[path]?.[method.toLowerCase()]?.responses;
  const entry = resolve(doc, declared?.[String(response.status)] ?? declared?.default);
  if (!entry) throw new Error(`${method} ${path}: HTTP ${response.status} no documentado`);
  for (const [name, header] of Object.entries(entry.headers ?? {})) {
    const value = response.headers.get(name);
    const schema = resolve(doc, header).schema;
    if (value !== null && schema) assertSchema(doc, schema, value);
  }
  const text = await response.text();
  if (!text) {
    if (entry.content) throw new Error('Respuesta inesperadamente vacía');
    return undefined;
  }
  const media = entry.content?.[response.headers.get('content-type')?.split(';')[0] ?? ''];
  if (!media?.schema) throw new Error(`${method} ${path}: medio sin esquema`);
  const body = response.headers.get('content-type')?.includes('json') ? JSON.parse(text) : text;
  assertSchema(doc, media.schema, body);
  return body;
}
