import { isPhotoKind, isStatus, type Handoff, type PhotoKind, type Severity, type Status, isSeverity } from './types.js';

/**
 * Character classes match src/domain/validate.ts in the Expo app.
 * Kept here on purpose: the API does not trust the client.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HANDLE = /^[A-Za-z0-9][A-Za-z0-9 ._-]{0,31}$/;
const SERVICE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const UNSUPPORTED = /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/;
const DAY = 24 * 60 * 60 * 1000;

export type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

function fail(error: string): { ok: false; error: string } {
  return { ok: false, error };
}

function cleanText(value: unknown, field: string, max: number, empty: string): ParseResult<string> {
  if (typeof value !== 'string') return fail(`${field} is required`);
  const trimmed = value.trim();
  if (!trimmed) return fail(empty);
  if (trimmed.length > max) return fail(`${field} must be ${max} characters or fewer`);
  if (UNSUPPORTED.test(trimmed)) return fail(`${field} contains an unsupported character`);
  return { ok: true, value: trimmed };
}

function parseTimestamp(value: unknown, field: string): ParseResult<string> {
  if (typeof value !== 'string') return fail(`${field} must be an ISO date`);
  const ms = Date.parse(value);
  if (Number.isNaN(ms)) return fail(`${field} must be an ISO date`);
  if (ms > Date.now() + DAY) return fail(`${field} is too far in the future`);
  if (ms < Date.UTC(2000, 0, 1)) return fail(`${field} is too far in the past`);
  return { ok: true, value: new Date(ms).toISOString() };
}

export function isUuid(value: string): boolean {
  return UUID.test(value);
}

export function parseCreate(body: unknown): ParseResult<Handoff> {
  if (!body || typeof body !== 'object') return fail('Request body must be a JSON object');
  const record = body as Record<string, unknown>;

  if (typeof record.id !== 'string' || !isUuid(record.id)) return fail('id must be a uuid');

  const title = cleanText(record.title, 'Title', 120, 'Title is required');
  if (!title.ok) return title;
  const notes = cleanText(record.notes, 'Notes', 4000, 'Notes are required');
  if (!notes.ok) return notes;

  if (!isSeverity(record.severity)) return fail('Severity must be low, medium, high, or critical');
  const severity: Severity = record.severity;

  let status: Status = 'open';
  if (record.status !== undefined && record.status !== null) {
    if (!isStatus(record.status)) return fail('Status must be open, acknowledged, or resolved');
    status = record.status;
  }

  const service = cleanText(record.service, 'Service', 64, 'Service is required');
  if (!service.ok) return service;
  if (!SERVICE.test(service.value)) return fail('Service must use letters, numbers, dots, hyphens, or underscores');

  const author = cleanText(record.author, 'Author', 32, 'Author is required');
  if (!author.ok) return author;
  if (!HANDLE.test(author.value)) return fail('Author must be a handle of at most 32 characters');

  let photoKind: PhotoKind | null = null;
  if (record.photoKind !== undefined && record.photoKind !== null) {
    if (!isPhotoKind(record.photoKind)) return fail('Snapshot type is not recognized');
    photoKind = record.photoKind;
  }

  const createdAt = parseTimestamp(record.createdAt, 'createdAt');
  if (!createdAt.ok) return createdAt;
  const updatedRaw = record.updatedAt === undefined ? record.createdAt : record.updatedAt;
  const updatedAt = parseTimestamp(updatedRaw, 'updatedAt');
  if (!updatedAt.ok) return updatedAt;

  return {
    ok: true,
    value: {
      id: record.id,
      title: title.value,
      notes: notes.value,
      severity,
      status,
      service: service.value,
      author: author.value,
      photoKind,
      createdAt: createdAt.value,
      updatedAt: updatedAt.value,
    },
  };
}

export function parseStatus(body: unknown): ParseResult<Status> {
  if (!body || typeof body !== 'object') return fail('Request body must be a JSON object');
  const status = (body as Record<string, unknown>).status;
  if (!isStatus(status)) return fail('Status must be open, acknowledged, or resolved');
  return { ok: true, value: status };
}
