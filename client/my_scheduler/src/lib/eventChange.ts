export interface ChangeInfo {
  event: { id: string; start: Date | null; end: Date | null; startStr?: string; endStr?: string; allDay?: boolean };
  revert(): void;
}

function parse(iso: string | undefined, fallback: Date | null): Date | null {
  if (iso) {
    const d = new Date(iso);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return fallback;
}

export async function persistEventChange(
  info: ChangeInfo,
  update: (id: string, patch: { start_at: string; end_at: string }) => Promise<unknown>,
  onSaved: () => void,
  onError: (message: string) => void
): Promise<void> {
  const { id, allDay } = info.event;
  // Prefer the ISO strings (they carry the calendar's zone offset) over the Date objects.
  const start = parse(info.event.startStr, info.event.start);
  const end = parse(info.event.endStr, info.event.end);
  if (allDay || !start || !end || end.getTime() <= start.getTime()) {
    info.revert();
    onError('Events need a start and end time, and the end must be after the start.');
    return;
  }
  try {
    await update(id, { start_at: start.toISOString(), end_at: end.toISOString() });
    onSaved();
  } catch (err) {
    info.revert();
    onError(err instanceof Error ? err.message : 'Could not save that change.');
  }
}
