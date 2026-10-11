import {
  ApiEvent, ConflictIgnore, ConflictsResponse, ConflictZone, EventInput, Settings, WorkHour,
} from './types';

export class ApiClientError extends Error {
  constructor(public code: string, message: string, public status?: number) {
    super(message);
    this.name = 'ApiClientError';
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    });
  } catch {
    throw new ApiClientError('network', 'Cannot reach the server');
  }
  if (res.status === 204) return undefined as T;
  let body: any = null;
  try {
    body = await res.json();
  } catch {
    /* non-JSON body */
  }
  if (!res.ok) {
    throw new ApiClientError(
      body?.error?.code ?? 'http_error',
      body?.error?.message ?? `Request failed (${res.status})`,
      res.status
    );
  }
  return body as T;
}

function windowQuery(from?: Date, to?: Date): string {
  const p = new URLSearchParams();
  if (from) p.set('from', from.toISOString());
  if (to) p.set('to', to.toISOString());
  const s = p.toString();
  return s ? `?${s}` : '';
}

const json = (method: string, body: unknown): RequestInit => ({ method, body: JSON.stringify(body) });

export const listEvents = (from?: Date, to?: Date) => request<ApiEvent[]>(`/api/events${windowQuery(from, to)}`);
export const createEvent = (input: EventInput) => request<ApiEvent>('/api/events', json('POST', input));
export const updateEvent = (id: string, patch: Partial<EventInput>) =>
  request<ApiEvent>(`/api/events/${id}`, json('PUT', patch));
export const deleteEvent = (id: string) => request<void>(`/api/events/${id}`, { method: 'DELETE' });

export const getConflicts = (from?: Date, to?: Date) =>
  request<ConflictsResponse>(`/api/conflicts${windowQuery(from, to)}`);

export const listWorkHours = () => request<WorkHour[]>('/api/work-hours');
export const putWorkHours = (workHours: WorkHour[]) => request<WorkHour[]>('/api/work-hours', json('PUT', { workHours }));

export const listZones = () => request<ConflictZone[]>('/api/conflict-zones');
export const createZone = (input: { start_at: string; end_at: string; repeats_weekly: boolean }) =>
  request<ConflictZone>('/api/conflict-zones', json('POST', input));
export const deleteZone = (id: string) => request<void>(`/api/conflict-zones/${id}`, { method: 'DELETE' });

export const listIgnores = () => request<ConflictIgnore[]>('/api/conflict-ignores');
export const createIgnore = (input: { eventAId: string; eventBId: string; mode: 'once' | 'allow' }) =>
  request<void>('/api/conflict-ignores', json('POST', input));
export const deleteIgnore = (id: string) => request<void>(`/api/conflict-ignores/${id}`, { method: 'DELETE' });

export const getSettings = () => request<Settings>('/api/settings');
export const updateSettings = (settings: Settings) => request<Settings>('/api/settings', json('PUT', settings));
