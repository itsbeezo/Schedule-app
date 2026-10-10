import { useCallback, useEffect, useState } from 'react';
import * as api from '../api/client';
import { ApiEvent, ConflictsResponse, ConflictZone, WorkHour } from '../api/types';

export interface Range {
  from: Date;
  to: Date;
}

export function useCalendarData() {
  const [range, setRange] = useState<Range | null>(null);
  const [events, setEvents] = useState<ApiEvent[]>([]);
  const [workHours, setWorkHours] = useState<WorkHour[]>([]);
  const [zones, setZones] = useState<ConflictZone[]>([]);
  const [conflicts, setConflicts] = useState<ConflictsResponse>({ active: [], ignored: [] });
  const [loadError, setLoadError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!range) return;
    try {
      const [e, w, z, c] = await Promise.all([
        api.listEvents(range.from, range.to),
        api.listWorkHours(),
        api.listZones(),
        api.getConflicts(range.from, range.to),
      ]);
      setEvents(e);
      setWorkHours(w);
      setZones(z);
      setConflicts(c);
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Could not load your calendar');
    }
  }, [range]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { events, workHours, zones, conflicts, range, setRange, loadError, reload, setEvents };
}
