import { ApiError } from './errors';
import { isReservedColor } from './reservedColors';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HEX_RE = /^#[0-9a-fA-F]{6}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

export function bad(message: string, field: string): never {
  throw new ApiError(400, 'validation_error', message, { field });
}

export function requireUuid(value: unknown, field = 'id'): string {
  if (typeof value !== 'string' || !UUID_RE.test(value)) bad(`${field} must be a UUID`, field);
  return (value as string).toLowerCase();
}

export function parseDate(value: unknown, field: string): Date {
  if (typeof value !== 'string') bad(`${field} must be an ISO timestamp`, field);
  const d = new Date(value as string);
  if (Number.isNaN(d.getTime())) bad(`${field} must be a valid ISO timestamp`, field);
  return d;
}

export function optionalDate(value: unknown, field: string): Date | null {
  return value === undefined || value === '' ? null : parseDate(value, field);
}

export function parseTime(value: unknown, field: string): string {
  if (typeof value !== 'string' || !TIME_RE.test(value)) bad(`${field} must be HH:MM`, field);
  return (value as string).slice(0, 5);
}

export interface EventFields {
  title: string;
  start_at: Date;
  end_at: Date;
  kind: 'event' | 'time_block';
  color: string | null;
  notes: string | null;
}

/** Validates a create body (no `existing`) or merges a partial update over `existing`. */
export function parseEventFields(body: unknown, existing?: EventFields): EventFields {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const has = (k: string) => Object.prototype.hasOwnProperty.call(b, k);
  if (!existing) {
    for (const k of ['title', 'start_at', 'end_at']) if (!has(k)) bad(`${k} is required`, k);
  }
  const out: EventFields = existing
    ? { ...existing }
    : { title: '', start_at: new Date(0), end_at: new Date(0), kind: 'event', color: null, notes: null };

  if (has('title')) {
    if (typeof b.title !== 'string') bad('title must be a string', 'title');
    const t = (b.title as string).trim();
    if (!t) bad('title must not be empty', 'title');
    if (t.length > 200) bad('title must be at most 200 characters', 'title');
    out.title = t;
  }
  if (has('start_at')) out.start_at = parseDate(b.start_at, 'start_at');
  if (has('end_at')) out.end_at = parseDate(b.end_at, 'end_at');
  if (has('kind')) {
    if (b.kind !== 'event' && b.kind !== 'time_block') bad("kind must be 'event' or 'time_block'", 'kind');
    out.kind = b.kind as EventFields['kind'];
  }
  if (has('color')) {
    if (b.color === null) {
      out.color = null;
    } else {
      if (typeof b.color !== 'string' || !HEX_RE.test(b.color)) bad('color must be a #RRGGBB hex value', 'color');
      if (isReservedColor(b.color as string)) {
        throw new ApiError(400, 'reserved_color', 'That exact color is reserved by the app. Pick a different shade.', {
          field: 'color',
        });
      }
      out.color = b.color as string;
    }
  }
  if (has('notes')) {
    if (b.notes !== null && typeof b.notes !== 'string') bad('notes must be a string or null', 'notes');
    if (typeof b.notes === 'string' && b.notes.length > 5000) bad('notes must be at most 5000 characters', 'notes');
    out.notes = b.notes as string | null;
  }
  if (out.end_at.getTime() <= out.start_at.getTime()) bad('end_at must be after start_at', 'end_at');
  return out;
}
