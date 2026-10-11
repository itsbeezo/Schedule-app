import { persistEventChange } from './eventChange';

const info = (over = {}) => ({
  event: { id: 'e1', start: new Date('2026-10-06T10:15:00Z'), end: new Date('2026-10-06T11:45:00Z'), allDay: false, ...over },
  revert: jest.fn(),
});

test('saves the new start and end as ISO strings and reports success', async () => {
  const update = jest.fn().mockResolvedValue({});
  const onSaved = jest.fn();
  const i = info();
  await persistEventChange(i, update, onSaved, jest.fn());
  expect(update).toHaveBeenCalledWith('e1', { start_at: '2026-10-06T10:15:00.000Z', end_at: '2026-10-06T11:45:00.000Z' });
  expect(onSaved).toHaveBeenCalled();
  expect(i.revert).not.toHaveBeenCalled();
});

test('reverts and explains when the save fails', async () => {
  const update = jest.fn().mockRejectedValue(new Error('end_at must be after start_at'));
  const onError = jest.fn();
  const i = info();
  await persistEventChange(i, update, jest.fn(), onError);
  expect(i.revert).toHaveBeenCalled();
  expect(onError).toHaveBeenCalledWith('end_at must be after start_at');
});

test('reverts without calling the server when the end is missing, not after the start, or the drop is all-day', async () => {
  for (const bad of [
    { end: null },
    { end: new Date('2026-10-06T10:15:00Z') },
    { end: new Date('2026-10-06T09:00:00Z') },
    { allDay: true },
    { start: null },
  ]) {
    const update = jest.fn();
    const onError = jest.fn();
    const i = info(bad);
    await persistEventChange(i, update, jest.fn(), onError);
    expect(update).not.toHaveBeenCalled();
    expect(i.revert).toHaveBeenCalled();
    expect(onError).toHaveBeenCalled();
  }
});

test('uses the ISO strings (with zone offset) for the saved instants', async () => {
  const update = jest.fn().mockResolvedValue({});
  // Tokyo wall clock 09:15-10:45 on the 6th; the Date objects are deliberately wrong to prove the strings win.
  const i = info({ startStr: '2026-10-06T09:15:00+09:00', endStr: '2026-10-06T10:45:00+09:00', start: new Date(0), end: new Date(1e12) });
  await persistEventChange(i, update, jest.fn(), jest.fn());
  expect(update).toHaveBeenCalledWith('e1', { start_at: '2026-10-06T00:15:00.000Z', end_at: '2026-10-06T01:45:00.000Z' });
});

test('DST day: a drop across the spring-forward gap keeps real durations', async () => {
  const update = jest.fn().mockResolvedValue({});
  const i = info({ startStr: '2026-03-08T01:00:00-05:00', endStr: '2026-03-08T03:00:00-04:00' });
  await persistEventChange(i, update, jest.fn(), jest.fn());
  expect(update).toHaveBeenCalledWith('e1', { start_at: '2026-03-08T06:00:00.000Z', end_at: '2026-03-08T07:00:00.000Z' });
});
