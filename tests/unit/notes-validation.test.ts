import { describe, expect, it } from 'vitest';
import { NotesError } from '../../src/modules/academico/notes/notes.errors.js';
import { normalizeScore, parseNoteCreate, parseNoteUpdate, rejectQuery, scoreProblem } from '../../src/modules/academico/notes/notes.validation.js';
import { AcademicError } from '../../src/modules/academico/shared/academic.errors.js';

const fieldsOf = (run: () => unknown) => {
  try { run(); } catch (error) { if (error instanceof NotesError) return error.fields; throw error; }
  throw new Error('no falló');
};

describe('notas · escala 1.0–5.0 con un decimal y punto (D-02, CA-03)', () => {
  it.each(['1', '1.0', '4.5', '4.0', '5', '5.0', '3.9'])('acepta %s', (value) => {
    expect(scoreProblem(value)).toBeNull();
  });
  it.each([
    ['0', 'out_of_range'], ['0.0', 'out_of_range'], ['0.9', 'out_of_range'], ['5.1', 'out_of_range'], ['6', 'out_of_range'],
    ['4.25', 'too_many_decimals'], ['5.00', 'too_many_decimals'],
    ['4,5', 'invalid_format'], ['abc', 'invalid_format'], ['-1', 'invalid_format'], [' 4.5', 'invalid_format'], ['4.', 'invalid_format'],
    ['', 'required'], ['  ', 'required'], [null, 'required'], [undefined, 'required'], [4.5, 'invalid_format'],
  ])('rechaza %j con %s', (value, reason) => {
    expect(scoreProblem(value)).toBe(reason);
  });
  it('normaliza a un decimal', () => {
    expect(normalizeScore('4')).toBe('4.0');
    expect(normalizeScore('4.5')).toBe('4.5');
  });
});

describe('notas · alta (CA-01, CA-04)', () => {
  it('acepta un cuerpo válido y normaliza el valor', () => {
    expect(parseNoteCreate({ subject: 'LENGUAJE', term: 1, score: '5' })).toEqual({ subject: 'LENGUAJE', term: 1, score: '5.0' });
    expect(parseNoteCreate({ subject: 'MATEMATICAS', term: 4, score: '1.0' })).toEqual({ subject: 'MATEMATICAS', term: 4, score: '1.0' });
  });
  it('informa todos los campos obligatorios a la vez', () => {
    expect(fieldsOf(() => parseNoteCreate({}))).toEqual([
      { field: 'subject', reason: 'required' }, { field: 'term', reason: 'required' }, { field: 'score', reason: 'required' }]);
  });
  it.each([
    [{ subject: 'ARTES', term: 1, score: '4.0' }, { field: 'subject', reason: 'invalid_format' }],
    [{ subject: 'LENGUAJE', term: 0, score: '4.0' }, { field: 'term', reason: 'out_of_range' }],
    [{ subject: 'LENGUAJE', term: 5, score: '4.0' }, { field: 'term', reason: 'out_of_range' }],
    [{ subject: 'LENGUAJE', term: 1.5, score: '4.0' }, { field: 'term', reason: 'invalid_format' }],
    [{ subject: 'LENGUAJE', term: '1', score: '4.0' }, { field: 'term', reason: 'invalid_format' }],
    [{ subject: 'LENGUAJE', term: 1, score: 4 }, { field: 'score', reason: 'invalid_format' }],
  ])('rechaza %j', (body, expected) => {
    expect(fieldsOf(() => parseNoteCreate(body))).toEqual([expected]);
  });
  it('rechaza claves desconocidas y cuerpos que no son objeto sin detalle de campos', () => {
    for (const body of [{ subject: 'LENGUAJE', term: 1, score: '4.0', extra: 1 }, null, [], 'x', 3]) {
      expect(() => parseNoteCreate(body)).toThrow(AcademicError);
    }
  });
});

describe('notas · actualización explícita (CA-05, CA-06)', () => {
  it('exige valor y versión esperada', () => {
    expect(parseNoteUpdate({ score: '4.5', expectedVersion: 2 })).toEqual({ score: '4.5', expectedVersion: 2 });
    expect(fieldsOf(() => parseNoteUpdate({}))).toEqual([
      { field: 'score', reason: 'required' }, { field: 'version', reason: 'required' }]);
    expect(fieldsOf(() => parseNoteUpdate({ score: '4.5', expectedVersion: 0 }))).toEqual([{ field: 'version', reason: 'invalid_format' }]);
    expect(fieldsOf(() => parseNoteUpdate({ score: '5.1', expectedVersion: 1 }))).toEqual([{ field: 'score', reason: 'out_of_range' }]);
  });
  it('no admite cambiar área ni periodo', () => {
    expect(() => parseNoteUpdate({ score: '4.5', expectedVersion: 1, subject: 'LENGUAJE' })).toThrow(AcademicError);
  });
});

describe('notas · consulta', () => {
  it('rechaza cualquier parámetro de consulta', () => {
    expect(() => rejectQuery('http://x/api/v1/students/a/academic-notes?year=2026')).toThrow(AcademicError);
    expect(() => rejectQuery('http://x/api/v1/students/a/academic-notes')).not.toThrow();
  });
});
