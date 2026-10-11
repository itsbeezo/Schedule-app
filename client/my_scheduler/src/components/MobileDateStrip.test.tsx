import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MobileDateStrip from './MobileDateStrip';

const sel = new Date(2026, 9, 14); // Wed Oct 14
const today = new Date(2026, 9, 11);

function setup(props = {}) {
  const onSelect = jest.fn();
  const onToday = jest.fn();
  render(<MobileDateStrip selected={sel} today={today} onSelect={onSelect} onToday={onToday} {...props} />);
  return { onSelect, onToday };
}

test('shows the month title and the 7 days of the selected week as labelled buttons', () => {
  setup();
  expect(screen.getByRole('button', { name: /October 2026/ })).toHaveAttribute('aria-expanded', 'false');
  const week = screen.getByRole('group', { name: 'This week' });
  expect(within(week).getAllByRole('button')).toHaveLength(7);
  expect(within(week).getByRole('button', { name: 'Sunday, October 11, 2026' })).toHaveAttribute('aria-current', 'date');
  expect(within(week).getByRole('button', { name: 'Wednesday, October 14, 2026' })).toHaveAttribute('aria-pressed', 'true');
  expect(within(week).getByRole('button', { name: 'Thursday, October 15, 2026' })).toHaveAttribute('aria-pressed', 'false');
});

test('tapping a day in the strip selects it', async () => {
  const { onSelect } = setup();
  await userEvent.click(screen.getByRole('button', { name: 'Friday, October 16, 2026' }));
  expect(onSelect).toHaveBeenCalledWith(new Date(2026, 9, 16));
});

test('the title expands a month picker; picking a far date selects it and collapses', async () => {
  const { onSelect } = setup();
  const toggle = screen.getByRole('button', { name: /October 2026/ });
  await userEvent.click(toggle);
  expect(toggle).toHaveAttribute('aria-expanded', 'true');
  const picker = screen.getByRole('group', { name: 'Choose a date' });
  await userEvent.click(within(picker).getByRole('button', { name: 'Next month' }));
  await userEvent.click(within(picker).getByRole('button', { name: 'Next month' }));
  expect(within(picker).getByText('December 2026')).toBeInTheDocument();
  await userEvent.click(within(picker).getByRole('button', { name: 'Tuesday, December 22, 2026' }));
  expect(onSelect).toHaveBeenCalledWith(new Date(2026, 11, 22));
  expect(screen.queryByRole('group', { name: 'Choose a date' })).toBeNull();
  expect(screen.getByRole('button', { name: /October 2026/ })).toHaveAttribute('aria-expanded', 'false');
});

test('Escape closes the picker and returns focus to the title', async () => {
  setup();
  const toggle = screen.getByRole('button', { name: /October 2026/ });
  await userEvent.click(toggle);
  await userEvent.keyboard('{Escape}');
  expect(screen.queryByRole('group', { name: 'Choose a date' })).toBeNull();
  expect(toggle).toHaveFocus();
});

test('Today calls onToday', async () => {
  const { onToday } = setup();
  await userEvent.click(screen.getByRole('button', { name: 'Today' }));
  expect(onToday).toHaveBeenCalled();
});

test('swiping the week strip moves by a week', () => {
  const { onSelect } = setup();
  const week = screen.getByRole('group', { name: 'This week' });
  fireEvent.touchStart(week, { touches: [{ clientX: 300, clientY: 20 }] });
  fireEvent.touchEnd(week, { touches: [], changedTouches: [{ clientX: 100, clientY: 22 }] });
  expect(onSelect).toHaveBeenCalledWith(new Date(2026, 9, 21));
});

test('days are keyboard operable buttons', async () => {
  const { onSelect } = setup();
  screen.getByRole('button', { name: 'Monday, October 12, 2026' }).focus();
  await userEvent.keyboard('{Enter}');
  expect(onSelect).toHaveBeenCalledWith(new Date(2026, 9, 12));
});

test('week strip is labelled by its first day when it does not contain today', () => {
  setup({ selected: new Date(2026, 9, 21) });
  expect(screen.getByRole('group', { name: 'Week of Sunday, October 18, 2026' })).toBeInTheDocument();
  expect(screen.queryByRole('group', { name: 'This week' })).toBeNull();
});

test('the chevron glyph is the same whether the picker is open or closed', async () => {
  setup();
  const btn = screen.getByRole('button', { name: /October 2026/ });
  const glyph = () => btn.querySelector('.date-strip__chevron')!.textContent;
  expect(glyph()).toBe('▾');
  await userEvent.click(btn);
  expect(glyph()).toBe('▾');
});
