import React from 'react';
import { render, screen } from '@testing-library/react';
import ColorPicker from './ColorPicker';

test('the custom colour input has a visible "Custom" label and keeps its accessible name', () => {
  render(<ColorPicker value={null} onChange={() => {}} />);
  const input = screen.getByLabelText('Custom color');
  expect(screen.getByText('Custom')).toBeVisible();
  expect(input.closest('label')).toHaveTextContent('Custom');
});
