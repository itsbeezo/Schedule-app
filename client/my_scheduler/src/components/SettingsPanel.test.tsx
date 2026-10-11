import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SettingsPanel from './SettingsPanel';
import { ToastProvider } from './Toast';
import * as api from '../api/client';

jest.mock('../api/client');
const mocked = api as jest.Mocked<typeof api>;

const zone = { id: 'z1', start_at: new Date(2026, 9, 5, 9, 0).toISOString(), end_at: new Date(2026, 9, 5, 17, 0).toISOString(), repeats_weekly: true };
const ignore = { id: 'i1', event_a_id: 'a', event_b_id: 'b', mode: 'allow' as const, overlap_start: null, overlap_end: null, event_a_title: 'Standup', event_b_title: 'Review' };

beforeEach(() => {
  jest.resetAllMocks();
  localStorage.clear();
  mocked.listWorkHours.mockResolvedValue([{ weekday: 1, start_time: '09:00', end_time: '17:00' }]);
  mocked.listZones.mockResolvedValue([zone]);
  mocked.listIgnores.mockResolvedValue([ignore]);
  mocked.deleteZone.mockResolvedValue(undefined);
  mocked.deleteIgnore.mockResolvedValue(undefined);
  mocked.putWorkHours.mockResolvedValue([]);
  mocked.getSettings.mockResolvedValue({ timezone: 'America/New_York' });
  mocked.updateSettings.mockImplementation(async (s) => s);
});

const setup = () => {
  const props = { onClose: jest.fn(), onChanged: jest.fn(), onScrollTimeChange: jest.fn() };
  render(<ToastProvider><SettingsPanel {...props} /></ToastProvider>);
  return props;
};

test('shows work hours, zones, and allowed overlaps loaded from the server', async () => {
  setup();
  expect(await screen.findByLabelText('Monday range 1 start')).toHaveValue('09:00');
  expect(screen.getByText(/repeats weekly/i)).toBeInTheDocument();
  expect(screen.getByText(/standup/i)).toBeInTheDocument();
  expect(screen.getByText(/review/i)).toBeInTheDocument();
});

test('removing a zone calls the API and tells the calendar to reload', async () => {
  mocked.listZones.mockReset().mockResolvedValueOnce([zone]).mockResolvedValue([]);
  const props = setup();
  await userEvent.click(await screen.findByRole('button', { name: /remove zone/i }));
  await waitFor(() => expect(mocked.deleteZone).toHaveBeenCalledWith('z1'));
  expect(props.onChanged).toHaveBeenCalled();
  await waitFor(() => expect(screen.queryByRole('button', { name: /remove zone/i })).toBeNull());
});

test('restoring a conflict deletes the allowance', async () => {
  mocked.listIgnores.mockReset().mockResolvedValueOnce([ignore]).mockResolvedValue([]);
  const props = setup();
  await userEvent.click(await screen.findByRole('button', { name: /restore conflict/i }));
  await waitFor(() => expect(mocked.deleteIgnore).toHaveBeenCalledWith('i1'));
  expect(props.onChanged).toHaveBeenCalled();
});

test('saving work hours calls the API and tells the calendar to reload', async () => {
  const props = setup();
  await screen.findByLabelText('Monday range 1 start');
  await userEvent.click(screen.getByRole('button', { name: /save work hours/i }));
  await waitFor(() => expect(mocked.putWorkHours).toHaveBeenCalledWith([{ weekday: 1, start_time: '09:00', end_time: '17:00' }]));
  expect(props.onChanged).toHaveBeenCalled();
});

test('choosing a default event color stores it; a reserved color is refused with an explanation', async () => {
  setup();
  await screen.findByLabelText('Monday range 1 start');
  await userEvent.click(screen.getByRole('button', { name: 'Color #3B4FD6' }));
  expect(localStorage.getItem('schedule.defaultEventColor')).toBe('#3B4FD6');
  fireEvent.change(screen.getByLabelText('Custom color'), { target: { value: '#ff8a5b' } });
  expect(screen.getByText(/reserved/i)).toBeInTheDocument();
  expect(localStorage.getItem('schedule.defaultEventColor')).toBe('#3B4FD6');
});

test('shows a message when settings cannot be loaded, and Close works', async () => {
  mocked.listWorkHours.mockRejectedValue(new Error('Cannot reach the server'));
  const props = setup();
  expect(await screen.findByText(/cannot reach the server/i)).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: /close/i }));
  expect(props.onClose).toHaveBeenCalled();
});

describe('Calendar starts at', () => {
  test('shows the stored value (default 07:00), saves a change, and tells the calendar', async () => {
    const props = setup();
    const input = await screen.findByLabelText('Calendar starts at');
    expect(input).toHaveValue('07:00');
    fireEvent.change(input, { target: { value: '06:30' } });
    expect(localStorage.getItem('schedule.scrollTime')).toBe('06:30');
    expect(props.onScrollTimeChange).toHaveBeenCalledWith('06:30');
    expect(input).toHaveValue('06:30');
  });

  test('a cleared (invalid) value is not stored', async () => {
    const props = setup();
    const input = await screen.findByLabelText('Calendar starts at');
    fireEvent.change(input, { target: { value: '' } });
    expect(localStorage.getItem('schedule.scrollTime')).toBeNull();
    expect(props.onScrollTimeChange).not.toHaveBeenCalled();
  });

  test('Reset to 07:00 restores the default and tells the calendar', async () => {
    localStorage.setItem('schedule.scrollTime', '05:00');
    const props = setup();
    expect(await screen.findByLabelText('Calendar starts at')).toHaveValue('05:00');
    await userEvent.click(screen.getByRole('button', { name: /reset to 07:00/i }));
    expect(localStorage.getItem('schedule.scrollTime')).toBeNull();
    expect(props.onScrollTimeChange).toHaveBeenCalledWith('07:00:00');
    expect(screen.getByLabelText('Calendar starts at')).toHaveValue('07:00');
  });
});

describe('focus management', () => {
  test('focus moves into the panel, Escape closes, and Tab wraps inside', async () => {
    const props = setup();
    await screen.findByLabelText('Monday range 1 start');
    const dialog = screen.getByRole('dialog', { name: /settings/i });
    expect(dialog.contains(document.activeElement)).toBe(true);
    const close = screen.getByRole('button', { name: /^close$/i });
    close.focus();
    await userEvent.tab({ shift: true });
    expect(dialog.contains(document.activeElement)).toBe(true);
    expect(document.activeElement).not.toBe(close);
    await userEvent.tab();
    expect(close).toHaveFocus();
    await userEvent.keyboard('{Escape}');
    expect(props.onClose).toHaveBeenCalled();
  });

  test('focus is restored to the opener on unmount', async () => {
    const opener = document.createElement('button');
    document.body.appendChild(opener);
    opener.focus();
    const { unmount } = render(<ToastProvider><SettingsPanel onClose={jest.fn()} onChanged={jest.fn()} /></ToastProvider>);
    await screen.findByLabelText('Monday range 1 start');
    unmount();
    expect(opener).toHaveFocus();
    opener.remove();
  });
});

describe('time zone field', () => {
  const field = () => screen.findByLabelText('Time zone', { selector: 'input' });
  const device = Intl.DateTimeFormat().resolvedOptions().timeZone;

  test('shows the saved zone and the detected device zone', async () => {
    setup();
    await waitFor(() => expect(screen.getByLabelText('Time zone', { selector: 'input' })).toHaveValue('America/New_York'));
    expect(screen.getByText(new RegExp(`device's time zone is ${device}`, 'i'))).toBeInTheDocument();
  });

  test('changing and saving calls the API and reloads the calendar', async () => {
    const props = setup();
    const input = await field();
    await waitFor(() => expect(input).toHaveValue('America/New_York'));
    await userEvent.clear(input);
    await userEvent.type(input, 'Asia/Tokyo');
    await act(async () => {
      await userEvent.click(screen.getByRole('button', { name: /save time zone/i }));
    });
    await waitFor(() => expect(mocked.updateSettings).toHaveBeenCalledWith({ timezone: 'Asia/Tokyo' }));
    expect(props.onChanged).toHaveBeenCalled();
    await waitFor(() => expect(screen.getByRole('button', { name: /save time zone/i })).toBeDisabled());
  });

  test('an invalid zone is rejected before calling the API', async () => {
    setup();
    const input = await field();
    await waitFor(() => expect(input).toHaveValue('America/New_York'));
    await userEvent.clear(input);
    await userEvent.type(input, 'Mars/Olympus');
    await userEvent.click(screen.getByRole('button', { name: /save time zone/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/valid time zone/i);
    expect(mocked.updateSettings).not.toHaveBeenCalled();
  });

  test('a server rejection is shown next to the field', async () => {
    mocked.updateSettings.mockRejectedValue(new Error('Unknown time zone'));
    setup();
    const input = await field();
    await waitFor(() => expect(input).toHaveValue('America/New_York'));
    await userEvent.clear(input);
    await userEvent.type(input, 'Asia/Tokyo');
    await userEvent.click(screen.getByRole('button', { name: /save time zone/i }));
    expect((await screen.findAllByText('Unknown time zone')).length).toBeGreaterThan(0);
    await waitFor(() => expect(screen.getByRole('button', { name: /save time zone/i })).not.toBeDisabled());
  });

  test('"Use this device\'s time zone" fills the field', async () => {
    mocked.getSettings.mockResolvedValue({ timezone: device === 'Asia/Tokyo' ? 'Europe/Paris' : 'Asia/Tokyo' });
    setup();
    await userEvent.click(await screen.findByRole('button', { name: /use this device's time zone/i }));
    await waitFor(() => expect(screen.getByLabelText('Time zone', { selector: 'input' })).toHaveValue(device));
  });

  test('no longer claims the grid uses the device zone, even when the saved zone differs', async () => {
    mocked.getSettings.mockResolvedValue({ timezone: device === 'Asia/Tokyo' ? 'Europe/Paris' : 'Asia/Tokyo' });
    setup();
    await waitFor(() => expect(screen.getByLabelText('Time zone', { selector: 'input' })).not.toHaveValue(''));
    expect(screen.queryByText(/grid still shows/i)).toBeNull();
  });

  test('no note when the saved zone is the device zone', async () => {
    mocked.getSettings.mockResolvedValue({ timezone: device });
    setup();
    await waitFor(() => expect(screen.getByLabelText('Time zone', { selector: 'input' })).toHaveValue(device));
    expect(screen.queryByText(/grid still shows/i)).toBeNull();
  });
});
