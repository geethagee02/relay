import { isHandoff, type Handoff, type Status } from '../domain/handoff';

const FALLBACK_BASE = 'http://127.0.0.1:8787';

export class ApiError extends Error {
  readonly status: number;
  readonly retryable: boolean;

  constructor(message: string, status: number, retryable: boolean) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.retryable = retryable;
  }
}

export function apiBase(): string {
  const raw = process.env.EXPO_PUBLIC_API_URL;
  if (typeof raw !== 'string') return FALLBACK_BASE;
  const trimmed = raw.trim().replace(/\/$/, '');
  return trimmed || FALLBACK_BASE;
}

function retryableStatus(status: number): boolean {
  return status === 0 || status === 408 || status === 429 || status >= 500;
}

function errorMessage(body: unknown, fallback: string): string {
  if (!body || typeof body !== 'object' || !('error' in body)) return fallback;
  const error = (body as { error: unknown }).error;
  return typeof error === 'string' && error.trim() ? error : fallback;
}

async function request(path: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    return await fetch(`${apiBase()}${path}`, {
      ...init,
      headers: {
        Accept: 'application/json',
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      },
      signal: controller.signal,
    });
  } catch (error) {
    const name = error instanceof Error ? error.name : '';
    if (name === 'AbortError') {
      throw new ApiError('The API took too long to answer', 0, true);
    }
    throw new ApiError('The API is unreachable', 0, true);
  } finally {
    clearTimeout(timer);
  }
}

async function readBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new ApiError('The API returned invalid JSON', response.status, retryableStatus(response.status));
  }
}

function handoffFrom(body: unknown, status: number): Handoff {
  if (!body || typeof body !== 'object' || !('handoff' in body) || !isHandoff((body as { handoff: unknown }).handoff)) {
    throw new ApiError('The API returned an unexpected handoff', status, false);
  }
  return (body as { handoff: Handoff }).handoff;
}

export async function listHandoffs(): Promise<Handoff[]> {
  const response = await request('/api/handoffs');
  const body = await readBody(response);
  if (!response.ok) {
    throw new ApiError(errorMessage(body, 'The API could not list handoffs'), response.status, retryableStatus(response.status));
  }
  if (!body || typeof body !== 'object' || !('handoffs' in body) || !Array.isArray((body as { handoffs: unknown }).handoffs)) {
    throw new ApiError('The API returned an unexpected list', response.status, false);
  }
  const handoffs = (body as { handoffs: unknown[] }).handoffs;
  if (!handoffs.every(isHandoff)) {
    throw new ApiError('The API returned an unexpected list', response.status, false);
  }
  return handoffs;
}

export async function createHandoff(handoff: Handoff): Promise<Handoff> {
  const response = await request('/api/handoffs', {
    method: 'POST',
    body: JSON.stringify(handoff),
  });
  const body = await readBody(response);
  if (!response.ok) {
    throw new ApiError(
      errorMessage(body, 'The API rejected this handoff'),
      response.status,
      retryableStatus(response.status),
    );
  }
  return handoffFrom(body, response.status);
}

export async function setStatus(id: string, status: Status): Promise<Handoff> {
  const response = await request(`/api/handoffs/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
  const body = await readBody(response);
  if (!response.ok) {
    throw new ApiError(
      errorMessage(body, 'The API rejected the status change'),
      response.status,
      retryableStatus(response.status),
    );
  }
  return handoffFrom(body, response.status);
}
