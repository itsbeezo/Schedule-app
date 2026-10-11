import React from 'react';
import { render } from '@testing-library/react';
import ConflictIcon from './ConflictIcon';

test('renders a circle with an exclamation bar and dot inside, aria-hidden', () => {
  const { container } = render(<ConflictIcon size={20} />);
  const svg = container.querySelector('svg')!;
  expect(svg.getAttribute('aria-hidden')).toBe('true');
  expect(svg.getAttribute('width')).toBe('20');
  const ring = svg.querySelector('circle:not([data-part])')!;
  expect(ring).not.toBeNull();
  expect(svg.querySelector('[data-part="bar"]')).not.toBeNull();
  expect(svg.querySelector('[data-part="dot"]')).not.toBeNull();
  expect(svg.querySelectorAll('path')).toHaveLength(1);
});
