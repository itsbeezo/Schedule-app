import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import WorkHoursEditor from './WorkHoursEditor';

const value = [{ weekday: 1, start_time: '09:00', end_time: '17:00' }];
const set = (el: HTMLElement, v: string) => fireEvent.change(el, { target: { value: v } });

test('shows existing ranges per weekday', () => {
  render(<WorkHoursEditor value={value} onSave={jest.fn()} />);
  expect(screen.getByLabelText('Monday range 1 start')).toHaveValue('09:00');
  expect(screen.getByLabelText('Monday range 1 end')).toHaveValue('17:00');
  expect(screen.queryByLabelText('Tuesday range 1 start')).toBeNull();
});

test('adds a range on another weekday and saves the full sorted set', async () => {
  const onSave = jest.fn().mockResolvedValue(undefined);
  render(<WorkHoursEditor value={value} onSave={onSave} />);
  await userEvent.click(screen.getByRole('button', { name: 'Add range to Tuesday' }));
  set(screen.getByLabelText('Tuesday range 1 start'), '10:00');
  set(screen.getByLabelText('Tuesday range 1 end'), '12:30');
  await userEvent.click(screen.getByRole('button', { name: /save work hours/i }));
  await waitFor(() => expect(screen.getByRole('button', { name: /save work hours/i })).toBeEnabled());
  expect(onSave).toHaveBeenCalledWith([
    { weekday: 1, start_time: '09:00', end_time: '17:00' },
    { weekday: 2, start_time: '10:00', end_time: '12:30' },
  ]);
});

test('removing a range removes it from the saved set', async () => {
  const onSave = jest.fn().mockResolvedValue(undefined);
  render(<WorkHoursEditor value={value} onSave={onSave} />);
  await userEvent.click(screen.getByRole('button', { name: 'Remove Monday range 1' }));
  await userEvent.click(screen.getByRole('button', { name: /save work hours/i }));
  await waitFor(() => expect(screen.getByRole('button', { name: /save work hours/i })).toBeEnabled());
  expect(onSave).toHaveBeenCalledWith([]);
});

test('rejects an end that is not after the start, and overlapping ranges, without saving', async () => {
  const onSave = jest.fn();
  render(<WorkHoursEditor value={value} onSave={onSave} />);
  set(screen.getByLabelText('Monday range 1 end'), '08:00');
  await userEvent.click(screen.getByRole('button', { name: /save work hours/i }));
  expect(screen.getByText(/monday: end must be after the start/i)).toBeInTheDocument();
  set(screen.getByLabelText('Monday range 1 end'), '17:00');
  await userEvent.click(screen.getByRole('button', { name: 'Add range to Monday' }));
  set(screen.getByLabelText('Monday range 2 start'), '16:00');
  set(screen.getByLabelText('Monday range 2 end'), '18:00');
  await userEvent.click(screen.getByRole('button', { name: /save work hours/i }));
  expect(screen.getByText(/monday: ranges overlap/i)).toBeInTheDocument();
  expect(onSave).not.toHaveBeenCalled();
});
