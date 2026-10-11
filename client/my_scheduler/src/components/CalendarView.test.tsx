import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CalendarView, { CALENDAR_OPTIONS, describeEvent, moreLinkLabel, toFullCalendarEvent, isNarrowViewport, NARROW_QUERY } from './CalendarView';
import { ToastProvider } from './Toast';
import * as api from '../api/client';
import { navCalls, optionIdentities, scrollToTimeCalls } from '../test/fullCalendarMock';

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
  mocked.getSettings.mockResolvedValue({ timezone: Intl.DateTimeFormat().resolvedOptions().timeZone });
  mocked.listWorkHours.mockResolvedValue([{ weekday: 1, start_time: '09:00', end_time: '17:00' }]);
  mocked.listZones.mockResolvedValue([]);
  mocked.getConflicts.mockResolvedValue({ active: [], ignored: [] });
  mocked.createIgnore.mockResolvedValue(undefined);
  mocked.deleteIgnore.mockResolvedValue(undefined);
  mocked.listIgnores.mockResolvedValue([]);
  scrollToTimeCalls.length = 0;
  optionIdentities.headerToolbar.clear();
  optionIdentities.views.clear();
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

test('Add event defaults to a 30 minute duration', async () => {
  renderView();
  await screen.findByText('Planning');
  await userEvent.click(screen.getByRole('button', { name: /add event/i }));
  const start = new Date((screen.getByLabelText(/^start/i) as HTMLInputElement).value).getTime();
  const end = new Date((screen.getByLabelText(/^end/i) as HTMLInputElement).value).getTime();
  expect(end - start).toBe(30 * 60 * 1000);
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

  test('narrow starts on a single-day grid, hides the FullCalendar toolbar and shows the date strip', async () => {
    (window as any).matchMedia = mm(true);
    renderView();
    const cal = await screen.findByTestId('calendar');
    expect(cal).toHaveAttribute('data-initial-view', 'timeGridDay');
    expect(cal).toHaveAttribute('data-toolbar', 'off');
    expect(screen.getByRole('group', { name: /^(This week|Week of )/  })).toBeInTheDocument();
  });

  test('wide has no date strip', async () => {
    (window as any).matchMedia = mm(false);
    renderView();
    await screen.findByTestId('calendar');
    expect(screen.queryByRole('group', { name: /^(This week|Week of )/  })).toBeNull();
    expect(screen.getByTestId('calendar')).toHaveAttribute('data-toolbar', 'on');
  });

  test('tapping a date in the strip and the picker jumps the calendar and loads that day', async () => {
    (window as any).matchMedia = mm(true);
    renderView();
    await screen.findByTestId('calendar');
    navCalls.length = 0;
    await userEvent.click(screen.getByRole('button', { name: /choose date picker/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Next month' }));
    await userEvent.click(screen.getByRole('button', { name: 'Tuesday, November 10, 2026' }));
    expect(navCalls).toEqual(['gotoDate:2026-11-10']);
    await waitFor(() => expect(mocked.listEvents).toHaveBeenLastCalledWith(new Date(2026, 10, 10), new Date(2026, 10, 11)));
    expect(screen.getByRole('button', { name: /November 2026/ })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Today' }));
    expect(navCalls).toContain('today');
  });

  test('swiping the grid changes day, but not from an event block or while dragging', async () => {
    (window as any).matchMedia = mm(true);
    renderView();
    const cal = await screen.findByTestId('calendar');
    navCalls.length = 0;
    const end = (x: number) => ({ touches: [], changedTouches: [{ clientX: x, clientY: 100 }] });
    const start = { touches: [{ clientX: 300, clientY: 100 }] };
    fireEvent.touchStart(cal, start);
    fireEvent.touchEnd(cal, end(100));
    fireEvent.touchStart(cal, { touches: [{ clientX: 100, clientY: 100 }] });
    fireEvent.touchEnd(cal, end(300));
    expect(navCalls).toEqual(['next', 'prev']);
    navCalls.length = 0;
    const evt = await screen.findByTestId('event-e1');
    fireEvent.touchStart(evt, start);
    fireEvent.touchEnd(evt, end(100));
    expect(navCalls).toEqual([]);
    const band = document.createElement('div');
    band.className = 'fc-event cal-work-hours fc-bg-event';
    cal.appendChild(band);
    fireEvent.touchStart(band, start);
    fireEvent.touchEnd(band, end(100));
    expect(navCalls).toEqual(['next']);
    navCalls.length = 0;
    cal.removeChild(band);
    const dragging = document.createElement('div');
    dragging.className = 'fc-event-dragging';
    cal.appendChild(dragging);
    fireEvent.touchStart(cal, start);
    fireEvent.touchEnd(cal, end(100));
    expect(navCalls).toEqual([]);
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

  test('crossing the 600px breakpoint live switches layout without remounting or losing the date', async () => {
    let listener: ((e: { matches: boolean }) => void) | undefined;
    (window as any).matchMedia = jest.fn().mockReturnValue({
      matches: false,
      addEventListener: (_: string, l: any) => { listener = l; },
      removeEventListener: () => { listener = undefined; },
    });
    const flip = (matches: boolean) => act(() => listener!({ matches }));
    renderView();
    const cal = await screen.findByTestId('calendar');
    expect(cal).toHaveAttribute('data-view', 'timeGridWeek');
    expect(screen.queryByRole('group', { name: /^(This week|Week of )/ })).toBeNull();
    // pick a month on the wide view first so the date is not "today"
    await userEvent.click(screen.getByText('mock-select'));
    flip(true);
    expect(screen.getByTestId('calendar')).toBe(cal);
    expect(cal).toHaveAttribute('data-view', 'timeGridDay');
    expect(cal).toHaveAttribute('data-toolbar', 'off');
    expect(screen.getByRole('group', { name: /^(This week|Week of )/ })).toBeInTheDocument();
    expect(navCalls).toContain('changeView:timeGridDay');
    // jump to a date on the phone, then widen: date kept, previous wide view restored
    await userEvent.click(screen.getByRole('button', { name: /choose date picker/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Next month' }));
    await userEvent.click(screen.getByRole('button', { name: 'Tuesday, November 10, 2026' }));
    flip(false);
    expect(screen.getByTestId('calendar')).toBe(cal);
    expect(cal).toHaveAttribute('data-view', 'timeGridWeek');
    expect(cal).toHaveAttribute('data-toolbar', 'on');
    expect(screen.queryByRole('group', { name: /^(This week|Week of )/ })).toBeNull();
    await waitFor(() => expect(mocked.listEvents).toHaveBeenLastCalledWith(new Date(2026, 10, 10), new Date(2026, 10, 11)));
  });

  test('there is no 3-day view any more', () => {
    expect(Object.keys(CALENDAR_OPTIONS.views ?? {})).toEqual(['dayGridMonth']);
    expect(CALENDAR_OPTIONS.snapDuration).toBe('00:15:00');
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

describe('unconflicted zones', () => {
  test('the toolbar offers Mark as unconflicted zone and saves the dragged range', async () => {
    mocked.createZone.mockResolvedValue({ id: 'z', start_at: '', end_at: '', repeats_weekly: false });
    renderView();
    await screen.findByText('Planning');
    await userEvent.click(screen.getByText('mock-select'));
    await userEvent.click(screen.getByRole('button', { name: /mark as unconflicted zone/i }));
    await waitFor(() =>
      expect(mocked.createZone).toHaveBeenCalledWith({
        start_at: new Date(2026, 9, 6, 9, 0).toISOString(),
        end_at: new Date(2026, 9, 6, 10, 0).toISOString(),
        repeats_weekly: false,
      })
    );
    await waitFor(() => expect(mocked.listZones).toHaveBeenCalledTimes(2));
  });

  test('"Repeat weekly" makes the zone repeat', async () => {
    mocked.createZone.mockResolvedValue({ id: 'z', start_at: '', end_at: '', repeats_weekly: true });
    renderView();
    await screen.findByText('Planning');
    await userEvent.click(screen.getByText('mock-select'));
    await userEvent.click(screen.getByLabelText(/repeat weekly/i));
    await userEvent.click(screen.getByRole('button', { name: /mark as unconflicted zone/i }));
    await waitFor(() => expect(mocked.createZone).toHaveBeenCalledWith(expect.objectContaining({ repeats_weekly: true })));
  });

  test('zones from the server are drawn as background bands', async () => {
    mocked.listZones.mockResolvedValue([
      { id: 'z', start_at: new Date(2026, 9, 6, 9, 0).toISOString(), end_at: new Date(2026, 9, 6, 17, 0).toISOString(), repeats_weekly: false },
    ]);
    renderView();
    await screen.findByText('Planning');
    await waitFor(() => expect(screen.getByTestId('bands')).toHaveTextContent('2'));
  });

  test('a failed zone save shows a toast and keeps the toolbar', async () => {
    mocked.createZone.mockRejectedValue(new Error('end_at must be after start_at'));
    renderView();
    await screen.findByText('Planning');
    await userEvent.click(screen.getByText('mock-select'));
    await userEvent.click(screen.getByRole('button', { name: /mark as unconflicted zone/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('end_at must be after start_at');
    expect(screen.getByRole('toolbar')).toBeInTheDocument();
  });
});

describe('settings panel', () => {
  afterEach(() => localStorage.clear());

  test('the Settings button opens the settings panel and Close hides it, returning focus to the button', async () => {
    renderView();
    await screen.findByText('Planning');
    const button = screen.getByRole('button', { name: /^settings$/i });
    await userEvent.click(button);
    expect(await screen.findByRole('dialog', { name: /settings/i })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(screen.queryByRole('dialog', { name: /settings/i })).toBeNull();
    expect(button).toHaveFocus();
  });

  test('changing "Calendar starts at" scrolls the open calendar and updates its scrollTime', async () => {
    renderView();
    await screen.findByText('Planning');
    await userEvent.click(screen.getByRole('button', { name: /^settings$/i }));
    const input = await screen.findByLabelText('Calendar starts at');
    fireEvent.change(input, { target: { value: '09:15' } });
    expect(scrollToTimeCalls).toEqual(['09:15']);
    expect(screen.getByTestId('calendar')).toHaveAttribute('data-scroll-time', '09:15');
  });
});

describe('short event blocks', () => {
  const short = (over = {}) => ev({ id: 's1', title: 'Quick', start_at: '2026-10-06T10:00:00.000Z', end_at: '2026-10-06T10:30:00.000Z', ...over });
  const s2 = () => ev({ id: 's2', title: 'Other', start_at: '2026-10-06T10:15:00.000Z', end_at: '2026-10-06T11:15:00.000Z' });
  const conflict = { eventAId: 's1', eventBId: 's2', overlapStart: '2026-10-06T10:15:00.000Z', overlapEnd: '2026-10-06T10:30:00.000Z' };

  test('a 30-minute conflicting block renders its badge before the title, keeping its label', async () => {
    mocked.listEvents.mockResolvedValue([short(), s2()]);
    mocked.getConflicts.mockResolvedValue({ active: [conflict], ignored: [] });
    renderView();
    await screen.findByText('Quick');
    const block = screen.getByTestId('event-s1');
    const badge = within(block).getByRole('button', { name: /^conflict: overlaps with other/i });
    const title = within(block).getByText('Quick');
    expect(badge.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  test('a longer block keeps the badge after the title', async () => {
    mocked.listEvents.mockResolvedValue([ev(), ev2()]);
    mocked.getConflicts.mockResolvedValue({ active: [activeConflict], ignored: [] });
    renderView();
    await screen.findByText('Planning');
    const block = screen.getByTestId('event-e1');
    const badge = within(block).getByRole('button', { name: /^conflict:/i });
    const title = within(block).getByText('Planning');
    expect(title.compareDocumentPosition(badge) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

test('re-rendering for popover, selection, dialog or settings state hands FullCalendar the same option objects', async () => {
  mocked.listEvents.mockResolvedValue([ev(), ev2()]);
  mocked.getConflicts.mockResolvedValue({ active: [activeConflict], ignored: [] });
  renderView();
  await screen.findByText('Planning');
  await userEvent.click(screen.getAllByRole('button', { name: /^conflict: overlaps with/i })[0]);
  await userEvent.keyboard('{Escape}');
  await userEvent.click(screen.getByRole('button', { name: 'mock-select' }));
  await userEvent.click(screen.getByRole('button', { name: /^cancel/i }));
  await userEvent.click(screen.getByRole('button', { name: /settings/i }));
  await screen.findByRole('dialog', { name: /settings/i });
  await waitFor(() => expect(screen.getByLabelText(/calendar starts at/i)).toBeInTheDocument());
  expect(optionIdentities.headerToolbar.size).toBe(1);
  expect(optionIdentities.views.size).toBe(1);
});

describe('conflict popover anchors to the event block, not the badge', () => {
  const rect = (left: number, top: number, w: number, h: number) =>
    ({ left, top, right: left + w, bottom: top + h, width: w, height: h, x: left, y: top, toJSON: () => ({}) }) as DOMRect;

  async function openWith(eventRect: DOMRect, badgeRect: DOMRect) {
    mocked.listEvents.mockResolvedValue([ev(), ev2()]);
    mocked.getConflicts.mockResolvedValue({ active: [activeConflict], ignored: [] });
    renderView();
    await screen.findByText('Planning');
    const badge = screen.getAllByRole('button', { name: /^conflict: overlaps with/i })[0];
    const wrapper = badge.closest('.fc-event') as HTMLElement;
    expect(wrapper).not.toBeNull();
    const spy = jest.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
      if (this === wrapper) return eventRect;
      if (this === badge) return badgeRect;
      return rect(0, 0, 0, 0);
    });
    jest.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (this: HTMLElement) {
      return this.classList.contains('popover') ? 100 : 0;
    });
    await userEvent.click(badge);
    spy.mockRestore();
    return screen.getByRole('dialog', { name: /conflict options/i });
  }

  afterEach(() => jest.restoreAllMocks());

  test('opens below the event block bottom edge', async () => {
    const pop = await openWith(rect(120, 100, 200, 80), rect(130, 105, 20, 20));
    expect(pop).toHaveStyle({ top: '184px', left: '120px' });
  });

  test('flips above the event block top edge when there is no room below', async () => {
    const pop = await openWith(rect(120, 700, 200, 50), rect(130, 705, 20, 20));
    expect(pop).toHaveStyle({ top: `${700 - 4 - 100}px`, left: '120px' });
  });
});

describe('saved time zone drives the grid', () => {
  afterEach(() => { delete (window as any).__selectStr; delete (window as any).__dropStr; });

  test.each(['Asia/Tokyo', 'America/New_York'])('timeZone prop, create/drag ISO output and dialog wall clock in %s', async (tz) => {
    mocked.getSettings.mockResolvedValue({ timezone: tz });
    renderView();
    await screen.findByText('Planning');
    await waitFor(() => expect(screen.getByTestId('calendar')).toHaveAttribute('data-time-zone', tz));
    const off = tz === 'Asia/Tokyo' ? '+09:00' : '-04:00';
    (window as any).__selectStr = { startStr: `2026-10-06T09:00:00${off}`, endStr: `2026-10-06T10:00:00${off}` };
    await userEvent.click(screen.getByText('mock-select'));
    await userEvent.click(within(screen.getByRole('toolbar')).getByRole('button', { name: /add event/i }));
    expect(screen.getByLabelText(/^start/i)).toHaveValue('2026-10-06T09:00');
    expect(screen.getByLabelText(/^end/i)).toHaveValue('2026-10-06T10:00');
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }));
    // editing the 10:00Z event shows it in the saved zone
    await userEvent.click(screen.getByRole('button', { name: /open planning/i }));
    expect(screen.getByLabelText(/^start/i)).toHaveValue(tz === 'Asia/Tokyo' ? '2026-10-06T19:00' : '2026-10-06T06:00');
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }));
    // dragging persists the instant from the ISO string
    mocked.updateEvent.mockResolvedValue(ev());
    (window as any).__dropStr = { startStr: `2026-10-06T09:15:00${off}`, endStr: `2026-10-06T10:15:00${off}` };
    await userEvent.click(screen.getByRole('button', { name: /drag planning/i }));
    const utc = tz === 'Asia/Tokyo' ? ['2026-10-06T00:15:00.000Z', '2026-10-06T01:15:00.000Z'] : ['2026-10-06T13:15:00.000Z', '2026-10-06T14:15:00.000Z'];
    await waitFor(() => expect(mocked.updateEvent).toHaveBeenCalledWith('e1', { start_at: utc[0], end_at: utc[1] }));
  });
});

describe('event tooltip follows the saved zone', () => {
  afterEach(() => { delete (window as any).__dropStr; });
  test('title is re-rendered in the new zone after the time zone changes', async () => {
    mocked.getSettings.mockResolvedValue({ timezone: 'Asia/Tokyo' });
    renderView();
    const evt = await screen.findByTestId('event-e1');
    await waitFor(() => expect(evt.title).toContain('7:00'));
    mocked.getSettings.mockResolvedValue({ timezone: 'America/New_York' });
    mocked.updateEvent.mockResolvedValue(ev());
    await userEvent.click(screen.getByRole('button', { name: /drag planning/i }));
    await waitFor(() => expect(screen.getByTestId('event-e1').title).toContain('6:00'));
  });
});

describe('month view crowding', () => {
  test('month view caps events per day and shows "+N more" with a dated accessible name', () => {
    expect(CALENDAR_OPTIONS.views).toEqual({ dayGridMonth: { dayMaxEvents: 3 } });
    expect(CALENDAR_OPTIONS.dayMaxEvents).toBeUndefined(); // week/day views are not capped
    const content = CALENDAR_OPTIONS.moreLinkContent as (a: { num: number }) => string;
    expect(content({ num: 4 })).toBe('+4 more');
    expect(moreLinkLabel(1, null)).toBe('1 more event');
    expect(moreLinkLabel(4, '2026-10-06')).toBe('4 more events on Tuesday, October 6, 2026');
    const el = document.createElement('div');
    el.setAttribute('data-date', '2026-10-06');
    el.innerHTML = '<a class="fc-daygrid-more-link">x</a>';
    const a = el.querySelector('a') as HTMLElement;
    (CALENDAR_OPTIONS.moreLinkDidMount as any)({ el: a, num: 2 });
    expect(a).toHaveAttribute('aria-label', '2 more events on Tuesday, October 6, 2026');
  });
});
