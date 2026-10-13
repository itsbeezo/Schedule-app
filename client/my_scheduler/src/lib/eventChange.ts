export interface ChangeInfo {
  event: { id: string; start: Date | null; end: Date | null; allDay?: boolean };
  revert(): void;
}

export async function persistEventChange(
  info: ChangeInfo,
  update: (id: string, patch: { start_at: string; end_at: string }) => Promise<unknown>,
  onSaved: () => void,
  onError: (message: string) => void
): Promise<void> {
  const { id, allDay } = info.event;
  // With FullCalendar's named-zone plugin, event.start/end are already true instants for timed events.
  // (Do not re-parse startStr/endStr: all-day ones are date-only strings, which parse as UTC midnight.)
  // All-day drops are rejected below, so no date-only handling is needed here.
  const { start, end } = info.event;
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
