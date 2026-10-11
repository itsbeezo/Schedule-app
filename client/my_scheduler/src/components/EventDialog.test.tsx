import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React, { useState } from 'react';
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
  await waitFor(() => expect(screen.getByRole('button', { name: /save/i })).toBeEnabled());
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
  await waitFor(() => expect(screen.getByRole('button', { name: /save/i })).toBeEnabled());
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
  await waitFor(() => expect(screen.getByRole('button', { name: /save/i })).toBeEnabled());
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

test('does not log an act() warning when a successful save unmounts the dialog', async () => {
  const err = jest.spyOn(console, 'error').mockImplementation(() => {});
  function Host() {
    const [open, setOpen] = useState(true);
    return open ? (
      <EventDialog mode="create" initial={initial} onSave={async () => setOpen(false)} onClose={() => setOpen(false)} />
    ) : <p>closed</p>;
  }
  render(<Host />);
  await userEvent.type(screen.getByLabelText(/title/i), 'X');
  await userEvent.click(screen.getByRole('button', { name: /save/i }));
  expect(await screen.findByText('closed')).toBeInTheDocument();
  expect(err).not.toHaveBeenCalled();
  err.mockRestore();
});

test('a double click on Confirm delete deletes once', async () => {
  let resolve: () => void = () => {};
  const onDelete = jest.fn().mockImplementation(() => new Promise<void>((r) => { resolve = r; }));
  setup({ mode: 'edit', initial: { ...initial, id: 'e1', title: 'P' }, onDelete });
  await userEvent.click(screen.getByRole('button', { name: /^delete$/i }));
  await userEvent.dblClick(screen.getByRole('button', { name: /confirm delete/i }));
  expect(onDelete).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('button', { name: /confirm delete/i })).toBeDisabled();
  await act(async () => resolve());
});

test('a failed delete shows the error in the dialog and re-enables the button', async () => {
  const onDelete = jest.fn().mockRejectedValue(new Error('Nope'));
  setup({ mode: 'edit', initial: { ...initial, id: 'e1', title: 'P' }, onDelete });
  await userEvent.click(screen.getByRole('button', { name: /^delete$/i }));
  await userEvent.click(screen.getByRole('button', { name: /confirm delete/i }));
  expect(await screen.findByText(/nope/i)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /confirm delete/i })).toBeEnabled();
});

test('Escape is ignored while a save is in flight', async () => {
  const props = setup({ onSave: jest.fn().mockImplementation(() => new Promise(() => {})) });
  await userEvent.type(screen.getByLabelText(/title/i), 'X');
  await userEvent.click(screen.getByRole('button', { name: /save/i }));
  await userEvent.keyboard('{Escape}');
  expect(props.onClose).not.toHaveBeenCalled();
});

test('Tab and Shift+Tab wrap within the dialog', async () => {
  setup();
  const save = screen.getByRole('button', { name: /save/i });
  save.focus();
  await userEvent.tab();
  expect(screen.getByLabelText(/title/i)).toHaveFocus();
  await userEvent.tab({ shift: true });
  expect(save).toHaveFocus();
});

test('focus returns to the previously focused element on close', async () => {
  function Host() {
    const [open, setOpen] = useState(false);
    return (
      <>
        <button onClick={() => setOpen(true)}>trigger</button>
        {open && <EventDialog mode="create" initial={initial} onSave={jest.fn()} onClose={() => setOpen(false)} />}
      </>
    );
  }
  render(<Host />);
  await userEvent.click(screen.getByRole('button', { name: 'trigger' }));
  expect(screen.getByLabelText(/title/i)).toHaveFocus();
  await userEvent.keyboard('{Escape}');
  expect(screen.getByRole('button', { name: 'trigger' })).toHaveFocus();
});

describe('start change keeps the duration', () => {
  const startEl = () => screen.getByLabelText(/^start/i) as HTMLInputElement;
  const endEl = () => screen.getByLabelText(/^end/i) as HTMLInputElement;
  const thirty = { ...initial, start: new Date(2026, 9, 6, 15, 30), end: new Date(2026, 9, 6, 16, 0) };

  test('30-minute event moved to 4:00 PM ends at 4:30 PM', () => {
    setup({ initial: thirty });
    setValue(startEl(), '2026-10-06T16:00');
    expect(endEl().value).toBe('2026-10-06T16:30');
  });

  test('90-minute duration is preserved', () => {
    setup({ initial: { ...initial, start: new Date(2026, 9, 6, 9, 0), end: new Date(2026, 9, 6, 10, 30) } });
    setValue(startEl(), '2026-10-06T13:15');
    expect(endEl().value).toBe('2026-10-06T14:45');
  });

  test('crosses midnight and day changes', () => {
    setup({ initial: thirty });
    setValue(startEl(), '2026-10-06T23:45');
    expect(endEl().value).toBe('2026-10-07T00:15');
    setValue(startEl(), '2026-10-08T10:00');
    expect(endEl().value).toBe('2026-10-08T10:30');
  });

  test('start moved later than the old end still shifts the end', () => {
    setup({ initial: thirty });
    setValue(startEl(), '2026-10-06T20:00');
    expect(endEl().value).toBe('2026-10-06T20:30');
  });

  test('invalid previous duration leaves the end untouched', () => {
    setup({ initial: thirty });
    setValue(endEl(), '2026-10-06T15:00');
    setValue(startEl(), '2026-10-06T17:00');
    expect(endEl().value).toBe('2026-10-06T15:00');
    setValue(endEl(), '');
    setValue(startEl(), '2026-10-06T18:00');
    expect(endEl().value).toBe('');
  });

  test('end-only change does not move start and sets the new duration', () => {
    setup({ initial: thirty });
    setValue(endEl(), '2026-10-06T17:30');
    expect(startEl().value).toBe('2026-10-06T15:30');
    setValue(startEl(), '2026-10-06T14:00');
    expect(endEl().value).toBe('2026-10-06T16:00');
  });

  test('works in edit mode and saves the shifted ISO times', async () => {
    const props = setup({ mode: 'edit', initial: { ...thirty, id: 'e1', title: 'T' } });
    setValue(startEl(), '2026-10-06T16:00');
    await userEvent.click(screen.getByRole('button', { name: /save/i }));
    expect(props.onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        start_at: new Date(2026, 9, 6, 16, 0).toISOString(), end_at: new Date(2026, 9, 6, 16, 30).toISOString(),
      }),
      'e1'
    );
    await waitFor(() => expect(screen.getByRole('button', { name: /save/i })).toBeEnabled());
  });
});
