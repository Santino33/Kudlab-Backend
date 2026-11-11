// Única conversión día → instante para indicadores (COORD-02 r2, MSG-integrador-009).
// America/Bogota es UTC−5 fijo desde 1993 (sin horario de verano): se usa el desfase fijo.
const BOGOTA_OFFSET_HOURS = 5;
const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

export class IndicatorDateRangeError extends Error {
  readonly code = 'INVALID_INPUT';
  constructor(message: string) { super(message); this.name = 'IndicatorDateRangeError'; }
}

function parseDay(value: string): { year: number; month: number; day: number } {
  const match = DAY.exec(value);
  if (!match) throw new IndicatorDateRangeError('Fecha con formato YYYY-MM-DD no válido.');
  const year = Number(match[1]), month = Number(match[2]), day = Number(match[3]);
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (probe.getUTCFullYear() !== year || probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day)
    throw new IndicatorDateRangeError('Fecha no real.');
  return { year, month, day };
}

function bogotaMidnight(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day, BOGOTA_OFFSET_HOURS));
}

// `from` inclusivo desde 00:00 del día; `to` inclusivo hasta el día siguiente 00:00 (exclusivo).
// Devuelve instantes para la función interna; nunca fechas de calendario.
export function bogotaDayRange(from?: string, to?: string): { startedFrom?: Date; startedBefore?: Date } {
  const start = from === undefined ? undefined : parseDay(from);
  const end = to === undefined ? undefined : parseDay(to);
  if (start && end) {
    const a = bogotaMidnight(start.year, start.month, start.day).getTime();
    const b = bogotaMidnight(end.year, end.month, end.day).getTime();
    if (a > b) throw new IndicatorDateRangeError('La fecha inicial no puede ser posterior a la final.');
  }
  const result: { startedFrom?: Date; startedBefore?: Date } = {};
  if (start) result.startedFrom = bogotaMidnight(start.year, start.month, start.day);
  if (end) result.startedBefore = bogotaMidnight(end.year, end.month, end.day + 1);
  return result;
}
