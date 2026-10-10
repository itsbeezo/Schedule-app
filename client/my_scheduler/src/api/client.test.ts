import { ApiClientError, createEvent, deleteEvent, getConflicts, listEvents, updateEvent } from './client';

const okJson = (body: unknown, status = 200) =>
  Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) } as Response);

beforeEach(() => {
  global.fetch = jest.fn();
});

test('listEvents sends from/to as ISO strings', async () => {
  (global.fetch as jest.Mock).mockReturnValue(okJson([]));
  await listEvents(new Date('2026-01-05T00:00:00Z'), new Date('2026-01-12T00:00:00Z'));
  expect((global.fetch as jest.Mock).mock.calls[0][0]).toBe(
    '/api/events?from=2026-01-05T00%3A00%3A00.000Z&to=2026-01-12T00%3A00%3A00.000Z'
  );
});

test('listEvents without a window calls the bare endpoint', async () => {
  (global.fetch as jest.Mock).mockReturnValue(okJson([]));
  await listEvents();
  expect((global.fetch as jest.Mock).mock.calls[0][0]).toBe('/api/events');
});

test('createEvent POSTs JSON and returns the created event', async () => {
  (global.fetch as jest.Mock).mockReturnValue(okJson({ id: 'x' }, 201));
  const input = { title: 'T', start_at: 'a', end_at: 'b', kind: 'event' as const, color: null, notes: null };
  await expect(createEvent(input)).resolves.toEqual({ id: 'x' });
  const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
  expect(url).toBe('/api/events');
  expect(init.method).toBe('POST');
  expect(JSON.parse(init.body)).toEqual(input);
});

test('updateEvent PUTs a partial body to the event URL', async () => {
  (global.fetch as jest.Mock).mockReturnValue(okJson({ id: 'x' }));
  await updateEvent('x', { title: 'New' });
  const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
  expect(url).toBe('/api/events/x');
  expect(init.method).toBe('PUT');
  expect(JSON.parse(init.body)).toEqual({ title: 'New' });
});

test('deleteEvent resolves on 204', async () => {
  (global.fetch as jest.Mock).mockReturnValue(Promise.resolve({ ok: true, status: 204 } as Response));
  await expect(deleteEvent('x')).resolves.toBeUndefined();
});

test('server errors become ApiClientError with the server code and message', async () => {
  (global.fetch as jest.Mock).mockReturnValue(
    okJson({ error: { code: 'validation_error', message: 'end_at must be after start_at' } }, 400)
  );
  const err = await updateEvent('x', {}).catch((e) => e);
  expect(err).toBeInstanceOf(ApiClientError);
  expect(err).toMatchObject({ code: 'validation_error', message: 'end_at must be after start_at', status: 400 });
});

test('an error response without a body still yields a readable error', async () => {
  (global.fetch as jest.Mock).mockReturnValue(
    Promise.resolve({ ok: false, status: 502, json: () => Promise.reject(new Error('not json')) } as Response)
  );
  const err = await getConflicts().catch((e) => e);
  expect(err).toMatchObject({ code: 'http_error', message: 'Request failed (502)' });
});

test('a network failure becomes a "network" error', async () => {
  (global.fetch as jest.Mock).mockRejectedValue(new TypeError('Failed to fetch'));
  const err = await listEvents().catch((e) => e);
  expect(err).toMatchObject({ code: 'network', message: 'Cannot reach the server' });
});
