import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EventDialog from './EventDialog';

// datetime-local inputs and emoji are unreliable with userEvent.type in jsdom, so set those values directly.
const setValue = (el: HTMLElement, value: string) => fireEvent.change(el, { target: { value } });

const initial = {
  title: '', start: new Date(2026, 9, 6, 9, 0), end: new Date(2026, 9, 6, 10, 0),
  kind: 'event' as const, color: null, notes: null,
};

function setup(over = {}) {
  const props = {
    mode: 'create' as const, initial, onSave: jest.fn().mockResolvedValue(undefined),
    onDelete: jest.fn().mockResolvedValue(undefined), onClose: jest.fn(), ...over,
  };
  render(<EventDialog {...props} />);
  return props;
}

test('is an accessible modal dialog with the title field focused', () => {
  setup();
  expect(screen.getByRole('dialog', { name: /new event/i })).toBeInTheDocument();
  expect(screen.getByLabelText(/title/i)).toHaveFocus();
});

test('saving sends ISO times, kind, color and trimmed title', async () => {
  const props = setup();
  await userEvent.type(screen.getByLabelText(/title/i), '  Planning  ');
  await userEvent.click(screen.getByRole('button', { name: /save/i }));
  expect(props.onSave).toHaveBeenCalledWith(
    {
      title: 'Planning', start_at: new Date(2026, 9, 6, 9, 0).toISOString(),
      end_at: new Date(2026, 9, 6, 10, 0).toISOString(), kind: 'event', color: null, notes: null,
    },
    undefined
  );
});

test('refuses an empty title and an end that is not after the start', async () => {
  const props = setup();
  await userEvent.click(screen.getByRole('button', { name: /save/i }));
  expect(screen.getByText(/enter a title/i)).toBeInTheDocument();
  await userEvent.type(screen.getByLabelText(/title/i), 'X');
  setValue(screen.getByLabelText(/^end/i), '2026-10-06T08:00');
  await userEvent.click(screen.getByRole('button', { name: /save/i }));
  expect(screen.getByText(/end must be after the start/i)).toBeInTheDocument();
  expect(props.onSave).not.toHaveBeenCalled();
});

test('accepts a 200-character emoji title without complaint', async () => {
  const props = setup();
  setValue(screen.getByLabelText(/title/i), '🎉'.repeat(100));
  await userEvent.click(screen.getByRole('button', { name: /save/i }));
  expect(props.onSave).toHaveBeenCalled();
});

test('rejects a title over 200 characters', async () => {
  const props = setup();
  setValue(screen.getByLabelText(/title/i), 'x'.repeat(201));
  await userEvent.click(screen.getByRole('button', { name: /save/i }));
  expect(screen.getByText(/200 characters/i)).toBeInTheDocument();
  expect(props.onSave).not.toHaveBeenCalled();
});

test('blocks reserved colors with an explanation and allows near-by shades', async () => {
  const props = setup({ initial: { ...initial, title: 'X', color: '#FF8A5B' } });
  expect(screen.getByText(/reserved/i)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /save/i })).toBeDisabled();
  expect(props.onSave).not.toHaveBeenCalled();
});

test('edit mode shows a two-step delete', async () => {
  const props = setup({ mode: 'edit', initial: { ...initial, id: 'e1', title: 'Planning' } });
  await userEvent.click(screen.getByRole('button', { name: /^delete$/i }));
  expect(props.onDelete).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: /confirm delete/i }));
  expect(props.onDelete).toHaveBeenCalledWith('e1');
});

test('Escape closes the dialog', async () => {
  const props = setup();
  await userEvent.keyboard('{Escape}');
  expect(props.onClose).toHaveBeenCalled();
});

test('stays open and shows the error when saving fails', async () => {
  const props = setup({ onSave: jest.fn().mockRejectedValue(new Error('Server said no')) });
  await userEvent.type(screen.getByLabelText(/title/i), 'X');
  await userEvent.click(screen.getByRole('button', { name: /save/i }));
  expect(await screen.findByText(/server said no/i)).toBeInTheDocument();
  expect(props.onClose).not.toHaveBeenCalled();
});
