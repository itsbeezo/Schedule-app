import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CalendarView, { CALENDAR_OPTIONS, toFullCalendarEvent } from './CalendarView';
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
