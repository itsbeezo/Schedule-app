import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CalendarView, { CALENDAR_OPTIONS, describeEvent, toFullCalendarEvent, isNarrowViewport, NARROW_QUERY } from './CalendarView';
import { ToastProvider } from './Toast';
import * as api from '../api/client';

jest.mock('@fullcalendar/react', () => ({ __esModule: true, default: require('../test/fullCalendarMock').default }));
jest.mock('../api/client');
const mocked = api as jest.Mocked<typeof api>;

const ev = (over = {}) => ({
  id: 'e1', title: 'Planning', start_at: '2026-10-06T10:00:00.000Z', end_at: '2026-10-06T11:00:00.000Z',
  kind: 'event' as const, color: null, notes: null, source: 'local', ...over,
});

beforeEach(() => {
  jest.resetAllMocks();
  mocked.listEvents.mockResolvedValue([ev()]);
  mocked.listWorkHours.mockResolvedValue([{ weekday: 1, start_time: '09:00', end_time: '17:00' }]);
  mocked.listZones.mockResolvedValue([]);
  mocked.getConflicts.mockResolvedValue({ active: [], ignored: [] });
  mocked.createIgnore.mockResolvedValue(undefined);
  mocked.deleteIgnore.mockResolvedValue(undefined);
});

const renderView = () => render(<ToastProvider><CalendarView /></ToastProvider>);

test('loads and shows events and work-hours bands for the visible range', async () => {
  renderView();
  expect(await screen.findByText('Planning')).toBeInTheDocument();
  await waitFor(() => expect(screen.getByTestId('bands')).toHaveTextContent('1'));
  expect(mocked.listEvents).toHaveBeenCalledWith(new Date(2026, 9, 5), new Date(2026, 9, 12));
});

test('shows a visible error with a Retry button when the API is down, then recovers', async () => {
  mocked.listEvents.mockRejectedValueOnce(new Error('Cannot reach the server'));
  renderView();
  expect(await screen.findByText(/Cannot reach the server/)).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: /retry/i }));
  expect(await screen.findByText('Planning')).toBeInTheDocument();
  expect(screen.queryByText(/Cannot reach the server/)).toBeNull();
});

test('toFullCalendarEvent applies classes and a readable text color for user colors', () => {
  const plain = toFullCalendarEvent(ev());
  expect(plain.classNames).toEqual(['cal-event']);
  const block = toFullCalendarEvent(ev({ kind: 'time_block', color: '#7B5CD6' }));
  expect(block.classNames).toEqual(['cal-event', 'cal-event--time-block']);
  expect(block.backgroundColor).toBe('#7B5CD6');
  expect(['#FFFFFF', '#14102A']).toContain(block.textColor);
});

test('the calendar is configured for 15-minute snapping, no all-day row, and press-and-hold on touch', () => {
  expect(CALENDAR_OPTIONS).toMatchObject({
    snapDuration: '00:15:00',
    allDaySlot: false,
    editable: true,
    selectable: true,
    longPressDelay: 400,
    eventLongPressDelay: 400,
    selectLongPressDelay: 400,
  });
});

test('Add event opens an empty dialog and creating refreshes the calendar', async () => {
  mocked.createEvent.mockResolvedValue(ev({ id: 'new', title: 'Created' }));
  renderView();
  await screen.findByText('Planning');
  await userEvent.click(screen.getByRole('button', { name: /add event/i }));
  await userEvent.type(screen.getByLabelText(/title/i), 'Created');
  await userEvent.click(screen.getByRole('button', { name: /save/i }));
  await waitFor(() => expect(mocked.createEvent).toHaveBeenCalledWith(expect.objectContaining({ title: 'Created' })));
  await waitFor(() => expect(mocked.listEvents).toHaveBeenCalledTimes(2));
});

test('dragging a range offers Add event in a toolbar, which opens the dialog on that range', async () => {
  renderView();
  await screen.findByText('Planning');
  await userEvent.click(screen.getByText('mock-select'));
  const toolbar = screen.getByRole('toolbar');
  await userEvent.click(within(toolbar).getByRole('button', { name: /add event/i }));
  expect(screen.getByLabelText(/^start/i)).toHaveValue('2026-10-06T09:00');
});

test('clicking an event opens it for editing and saving updates it', async () => {
  mocked.updateEvent.mockResolvedValue(ev({ title: 'Renamed' }));
  renderView();
  await screen.findByText('Planning');
  await userEvent.click(screen.getByRole('button', { name: /open planning/i }));
  const title = screen.getByLabelText(/title/i);
  await userEvent.clear(title);
  await userEvent.type(title, 'Renamed');
  await userEvent.click(screen.getByRole('button', { name: /save/i }));
  await waitFor(() => expect(mocked.updateEvent).toHaveBeenCalledWith('e1', expect.objectContaining({ title: 'Renamed' })));
});

test('deleting an event calls the API and closes the dialog', async () => {
  mocked.deleteEvent.mockResolvedValue(undefined);
  renderView();
  await screen.findByText('Planning');
  await userEvent.click(screen.getByRole('button', { name: /open planning/i }));
  await userEvent.click(screen.getByRole('button', { name: /^delete$/i }));
  await userEvent.click(screen.getByRole('button', { name: /confirm delete/i }));
  await waitFor(() => expect(mocked.deleteEvent).toHaveBeenCalledWith('e1'));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
});

test('dropping an event saves its new times and refreshes conflicts', async () => {
  mocked.updateEvent.mockResolvedValue(ev());
  renderView();
  await screen.findByText('Planning');
  await userEvent.click(screen.getByRole('button', { name: /drag planning/i }));
  await waitFor(() =>
    expect(mocked.updateEvent).toHaveBeenCalledWith('e1', {
      start_at: '2026-10-06T11:00:00.000Z',
      end_at: '2026-10-06T12:00:00.000Z',
    })
  );
  await waitFor(() => expect(mocked.getConflicts).toHaveBeenCalledTimes(2));
});

test('a failed drop reverts the event and shows a toast', async () => {
  const revert = jest.fn();
  (window as any).__revert = revert;
  mocked.updateEvent.mockRejectedValue(new Error('Could not save that move'));
  renderView();
  await screen.findByText('Planning');
  await userEvent.click(screen.getByRole('button', { name: /drag planning/i }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not save that move');
  expect(revert).toHaveBeenCalled();
  delete (window as any).__revert;
});

describe('scrollTime', () => {
  afterEach(() => localStorage.clear());

  test('is 07:00:00 by default and the full grid is not clipped', async () => {
    renderView();
    await screen.findByText('Planning');
    expect(screen.getByTestId('calendar')).toHaveAttribute('data-scroll-time', '07:00:00');
    expect(CALENDAR_OPTIONS.slotMinTime).toBeUndefined();
    expect(CALENDAR_OPTIONS.slotMaxTime).toBeUndefined();
  });

  test('uses a stored preference', async () => {
    localStorage.setItem('schedule.scrollTime', '06:30');
    renderView();
    await screen.findByText('Planning');
    expect(screen.getByTestId('calendar')).toHaveAttribute('data-scroll-time', '06:30');
  });
});

test('the calendar has a bounded height so the time grid scrolls internally', () => {
  expect(CALENDAR_OPTIONS.height).toMatch(/^max\(480px, calc\(100vh/);
  expect(CALENDAR_OPTIONS.height).not.toBe('auto');
});

test('no slotMinTime/slotMaxTime reaches FullCalendar', async () => {
  renderView();
  await screen.findByText('Planning');
  expect(screen.getByTestId('calendar')).not.toHaveAttribute('data-slot-min-time');
  expect(screen.getByTestId('calendar')).not.toHaveAttribute('data-slot-max-time');
});

describe('narrow (phone) default view', () => {
  const mm = (matches: boolean) => jest.fn().mockReturnValue({ matches });
  afterEach(() => { delete (window as any).matchMedia; });

  test('isNarrowViewport reads the media query and falls back to false without matchMedia', () => {
    const fn = mm(true);
    expect(isNarrowViewport(fn as any)).toBe(true);
    expect(fn).toHaveBeenCalledWith(NARROW_QUERY);
    expect(NARROW_QUERY).toBe('(max-width: 600px)');
    expect(isNarrowViewport(mm(false) as any)).toBe(false);
    expect(isNarrowViewport(undefined)).toBe(false);
    expect(isNarrowViewport((() => { throw new Error('x'); }) as any)).toBe(false);
  });

  test('narrow starts on the 3-day view with a toolbar offering 3 day, Day and Month', async () => {
    (window as any).matchMedia = mm(true);
    renderView();
    const cal = await screen.findByTestId('calendar');
    expect(cal).toHaveAttribute('data-initial-view', 'timeGrid3Day');
    expect(cal).toHaveAttribute('data-toolbar-right', 'timeGridDay,timeGrid3Day,timeGridWeek,dayGridMonth');
  });

  test('wide (or no matchMedia) starts on the week with the unchanged toolbar', async () => {
    (window as any).matchMedia = mm(false);
    const { unmount } = renderView();
    let cal = await screen.findByTestId('calendar');
    expect(cal).toHaveAttribute('data-initial-view', 'timeGridWeek');
    expect(cal).toHaveAttribute('data-toolbar-right', 'timeGridDay,timeGridWeek,dayGridMonth');
    unmount();
    delete (window as any).matchMedia;
    renderView();
    cal = await screen.findByTestId('calendar');
    expect(cal).toHaveAttribute('data-initial-view', 'timeGridWeek');
  });

  test('the 3-day view is a 3-day time grid that inherits snapping, height and scroll settings', () => {
    const v = (CALENDAR_OPTIONS.views as any).timeGrid3Day;
    expect(v).toMatchObject({ type: 'timeGrid', duration: { days: 3 }, buttonText: '3 day' });
    for (const k of ['snapDuration', 'scrollTime', 'scrollTimeReset', 'height', 'editable', 'selectable', 'slotDuration']) {
      expect(v).not.toHaveProperty(k);
    }
    expect(CALENDAR_OPTIONS.snapDuration).toBe('00:15:00');
    expect(CALENDAR_OPTIONS.height).toMatch(/100vh/);
  });
});

const ev2 = () => ev({ id: 'e2', title: 'Dentist', start_at: '2026-10-06T10:30:00.000Z', end_at: '2026-10-06T11:30:00.000Z' });
const activeConflict = { eventAId: 'e1', eventBId: 'e2', overlapStart: '2026-10-06T10:30:00.000Z', overlapEnd: '2026-10-06T11:00:00.000Z' };

describe('conflict states', () => {
  test('an active conflict marks both events and shows a Conflict badge on each', async () => {
    mocked.listEvents.mockResolvedValue([ev(), ev2()]);
    mocked.getConflicts.mockResolvedValue({ active: [activeConflict], ignored: [] });
    renderView();
    await screen.findByText('Planning');
    expect(screen.getByTestId('event-e1')).toHaveClass('cal-event--conflict');
    expect(screen.getByTestId('event-e2')).toHaveClass('cal-event--conflict');
    expect(screen.getAllByRole('button', { name: /^conflict: overlaps with/i })).toHaveLength(2);
  });

  test('"Ignore this once" saves a once-ignore for the pair and refreshes conflicts', async () => {
    mocked.listEvents.mockResolvedValue([ev(), ev2()]);
    mocked.getConflicts.mockResolvedValue({ active: [activeConflict], ignored: [] });
    renderView();
    await screen.findByText('Planning');
    await userEvent.click(screen.getByRole('button', { name: /conflict: overlaps with dentist/i }));
    expect(screen.getByText(/overlaps with dentist/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /ignore this once/i }));
    await waitFor(() => expect(mocked.createIgnore).toHaveBeenCalledWith({ eventAId: 'e1', eventBId: 'e2', mode: 'once' }));
    await waitFor(() => expect(mocked.getConflicts).toHaveBeenCalledTimes(2));
  });

  test('"Allow overlap" saves an allow-ignore', async () => {
    mocked.listEvents.mockResolvedValue([ev(), ev2()]);
    mocked.getConflicts.mockResolvedValue({ active: [activeConflict], ignored: [] });
    renderView();
    await screen.findByText('Planning');
    await userEvent.click(screen.getByRole('button', { name: /conflict: overlaps with dentist/i }));
    await userEvent.click(screen.getByRole('button', { name: /allow overlap/i }));
    await waitFor(() => expect(mocked.createIgnore).toHaveBeenCalledWith({ eventAId: 'e1', eventBId: 'e2', mode: 'allow' }));
  });

  test('an ignored conflict is shown quietly and can be restored', async () => {
    mocked.listEvents.mockResolvedValue([ev(), ev2()]);
    mocked.getConflicts.mockResolvedValue({ active: [], ignored: [{ ...activeConflict, mode: 'allow', ignoreId: 'ign1' }] });
    renderView();
    await screen.findByText('Planning');
    expect(screen.getByTestId('event-e1')).toHaveClass('cal-event--ignored');
    expect(screen.getByTestId('event-e1')).not.toHaveClass('cal-event--conflict');
    await userEvent.click(screen.getAllByRole('button', { name: /^allowed: overlaps with/i })[0]);
    await userEvent.click(screen.getByRole('button', { name: /restore conflict/i }));
    await waitFor(() => expect(mocked.deleteIgnore).toHaveBeenCalledWith('ign1'));
  });

  test('a failed ignore shows a toast', async () => {
    mocked.listEvents.mockResolvedValue([ev(), ev2()]);
    mocked.getConflicts.mockResolvedValue({ active: [activeConflict], ignored: [] });
    mocked.createIgnore.mockRejectedValue(new Error('Those events do not overlap'));
    renderView();
    await screen.findByText('Planning');
    await userEvent.click(screen.getAllByRole('button', { name: /^conflict: overlaps with/i })[0]);
    await userEvent.click(screen.getByRole('button', { name: /allow overlap/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Those events do not overlap');
  });

  test('clicking a badge does not open the edit dialog, and Escape closes the popover', async () => {
    mocked.listEvents.mockResolvedValue([ev(), ev2()]);
    mocked.getConflicts.mockResolvedValue({ active: [activeConflict], ignored: [] });
    renderView();
    await screen.findByText('Planning');
    await userEvent.click(screen.getAllByRole('button', { name: /^conflict: overlaps with/i })[0]);
    expect(screen.getByRole('dialog', { name: /conflict options/i })).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('conflict popover keyboard and focus', () => {
  async function setup() {
    mocked.listEvents.mockResolvedValue([ev(), ev2()]);
    mocked.getConflicts.mockResolvedValue({ active: [activeConflict], ignored: [] });
    renderView();
    await screen.findByText('Planning');
    return screen.getAllByRole('button', { name: /^conflict: overlaps with/i })[0];
  }

  test.each([['Enter', '{Enter}'], ['Space', ' ']])('%s on the focused badge opens the popover, not the edit dialog', async (_n, key) => {
    const badge = await setup();
    badge.focus();
    await userEvent.keyboard(key);
    expect(screen.getByRole('dialog', { name: /conflict options/i })).toBeInTheDocument();
    expect(screen.queryByLabelText(/^title/i)).toBeNull();
  });

  test('Enter on the event itself still opens the edit dialog', async () => {
    await setup();
    screen.getByTestId('event-e1').focus();
    await userEvent.keyboard('{Enter}');
    expect(await screen.findByLabelText(/^title/i)).toBeInTheDocument();
  });

  test('focus moves to the first button on open, Tab stays inside, Escape restores focus to the badge', async () => {
    const badge = await setup();
    await userEvent.click(badge);
    const first = screen.getByRole('button', { name: /ignore this once/i });
    const last = screen.getByRole('button', { name: /allow overlap/i });
    expect(first).toHaveFocus();
    await userEvent.tab();
    expect(last).toHaveFocus();
    await userEvent.tab();
    expect(first).toHaveFocus();
    await userEvent.tab({ shift: true });
    expect(last).toHaveFocus();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(badge).toHaveFocus();
  });
});

describe('readable event labels for narrow blocks', () => {
  test('describeEvent gives "Title, start-end"', () => {
    const s = new Date(2026, 9, 6, 9, 0);
    const e = new Date(2026, 9, 6, 10, 30);
    const text = describeEvent('Dentist', s, e);
    expect(text.startsWith('Dentist, ')).toBe(true);
    expect(text).toContain('\u2013');
    expect(text).toMatch(/9:00/);
    expect(text).toMatch(/10:30/);
  });

  test('the calendar makes events focusable and sets a title on each event element', async () => {
    mocked.listEvents.mockResolvedValue([ev(), ev2()]);
    renderView();
    await screen.findByText('Planning');
    expect(CALENDAR_OPTIONS.eventInteractive).toBe(true);
    expect(screen.getByTestId('event-e2')).toHaveAttribute('title', expect.stringMatching(/^Dentist, .+\u2013.+/));
    expect(screen.getByTestId('event-e1')).toHaveAttribute('title', expect.stringMatching(/^Planning, /));
  });
});
