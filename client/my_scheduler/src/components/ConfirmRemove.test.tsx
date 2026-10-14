import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ConfirmRemove from './ConfirmRemove';

const setup = () => {
  const onConfirm = jest.fn();
  const outer = jest.fn();
  outerFn = outer;
  document.addEventListener('keydown', outer);
  render(<ConfirmRemove label="Remove" ariaLabel="Remove zone X" groupLabel="Confirm removing zone X" onConfirm={onConfirm} />);
  return { onConfirm, outer };
};
let outerFn: jest.Mock | null = null;
afterEach(() => { if (outerFn) document.removeEventListener('keydown', outerFn); });

test('clicking Remove asks first and does nothing until confirmed', async () => {
  const { onConfirm } = setup();
  await userEvent.click(screen.getByRole('button', { name: 'Remove zone X' }));
  expect(onConfirm).not.toHaveBeenCalled();
  expect(screen.getByRole('group', { name: 'Confirm removing zone X' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
  await userEvent.click(screen.getByRole('button', { name: 'Yes, remove' }));
  expect(onConfirm).toHaveBeenCalledTimes(1);
});

test('Cancel puts the original button back and focuses it', async () => {
  const { onConfirm } = setup();
  await userEvent.click(screen.getByRole('button', { name: 'Remove zone X' }));
  await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(onConfirm).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Remove zone X' })).toHaveFocus();
  expect(screen.queryByRole('group')).toBeNull();
});

test('Escape cancels, restores focus, and does not reach outer Escape handlers', async () => {
  const { onConfirm, outer } = setup();
  await userEvent.click(screen.getByRole('button', { name: 'Remove zone X' }));
  fireEvent.keyDown(screen.getByRole('button', { name: 'Cancel' }), { key: 'Escape' });
  expect(onConfirm).not.toHaveBeenCalled();
  expect(outer).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Remove zone X' })).toHaveFocus();
});
