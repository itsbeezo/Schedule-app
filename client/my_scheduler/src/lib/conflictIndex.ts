import { ConflictsResponse } from '../api/types';

export interface ConflictInfo {
  eventAId: string;
  eventBId: string;
  otherId: string;
  state: 'active' | 'ignored';
  mode?: 'once' | 'allow';
  ignoreId?: string;
}

export function indexConflicts(resp: ConflictsResponse): Map<string, ConflictInfo[]> {
  const map = new Map<string, ConflictInfo[]>();
  const add = (id: string, info: ConflictInfo) => map.set(id, [...(map.get(id) ?? []), info]);
  for (const c of resp.active) {
    add(c.eventAId, { eventAId: c.eventAId, eventBId: c.eventBId, otherId: c.eventBId, state: 'active' });
    add(c.eventBId, { eventAId: c.eventAId, eventBId: c.eventBId, otherId: c.eventAId, state: 'active' });
  }
  for (const c of resp.ignored) {
    const base = { eventAId: c.eventAId, eventBId: c.eventBId, state: 'ignored' as const, mode: c.mode, ignoreId: c.ignoreId };
    add(c.eventAId, { ...base, otherId: c.eventBId });
    add(c.eventBId, { ...base, otherId: c.eventAId });
  }
  return map;
}

export function eventConflictState(infos: ConflictInfo[] | undefined): 'active' | 'ignored' | null {
  if (!infos || infos.length === 0) return null;
  return infos.some((i) => i.state === 'active') ? 'active' : 'ignored';
}
