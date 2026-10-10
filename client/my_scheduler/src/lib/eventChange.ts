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
  const { id, start, end, allDay } = info.event;
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
