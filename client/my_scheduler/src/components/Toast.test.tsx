import { act, render, screen } from '@testing-library/react';
import { ToastProvider, useToast } from './Toast';

function Trigger() {
  const { showError } = useToast();
  return <button onClick={() => showError('Could not save')}>go</button>;
}

test('shows an error toast as an alert and removes it after a few seconds', () => {
  jest.useFakeTimers();
  render(<ToastProvider><Trigger /></ToastProvider>);
  act(() => screen.getByText('go').click());
  expect(screen.getByRole('alert')).toHaveTextContent('Could not save');
  act(() => { jest.advanceTimersByTime(6000); });
  expect(screen.queryByRole('alert')).toBeNull();
  jest.useRealTimers();
});
