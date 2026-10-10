export type EventKind = 'event' | 'time_block';

export interface ApiEvent {
  id: string;
  title: string;
  start_at: string;
  end_at: string;
  kind: EventKind;
  color: string | null;
  notes: string | null;
  source: string;
}

export interface EventInput {
  title: string;
  start_at: string;
  end_at: string;
  kind: EventKind;
  color: string | null;
  notes: string | null;
}

export interface WorkHour {
  weekday: number; // 0 = Sunday
  start_time: string; // HH:MM
  end_time: string; // HH:MM
}

export interface ConflictZone {
  id: string;
  start_at: string;
  end_at: string;
  repeats_weekly: boolean;
}

export interface Conflict {
  eventAId: string;
  eventBId: string;
  overlapStart: string;
  overlapEnd: string;
}

export interface IgnoredConflict extends Conflict {
  mode: 'once' | 'allow';
  ignoreId: string;
}

export interface ConflictsResponse {
  active: Conflict[];
  ignored: IgnoredConflict[];
}

export interface ConflictIgnore {
  id: string;
  event_a_id: string;
  event_b_id: string;
  mode: 'once' | 'allow';
  overlap_start: string | null;
  overlap_end: string | null;
  event_a_title: string;
  event_b_title: string;
}
