import React from 'react';
import { render } from '@testing-library/react';
import ConflictIcon from './ConflictIcon';

test('renders clock circle, hands, and an exclamation bar and dot, aria-hidden', () => {
  const { container } = render(<ConflictIcon size={16} />);
  const svg = container.querySelector('svg')!;
  expect(svg.getAttribute('aria-hidden')).toBe('true');
  expect(svg.getAttribute('height')).toBe('16');
  expect(svg.querySelector('[data-part="clock"]')).not.toBeNull();
  expect(svg.querySelector('[data-part="hands"]')).not.toBeNull();
  expect(svg.querySelector('[data-part="bar"]')).not.toBeNull();
  expect(svg.querySelector('[data-part="dot"]')).not.toBeNull();
  expect(svg.querySelectorAll('path')).toHaveLength(2);
});

test('the "!" sits strictly to the right of the clock circle with a visible gap', () => {
  const { container } = render(<ConflictIcon />);
  const svg = container.querySelector('svg')!;
  const clock = svg.querySelector('[data-part="clock"]')!;
  const right = Number(clock.getAttribute('cx')) + Number(clock.getAttribute('r')) + 0.75; // + half stroke
  const bar = svg.querySelector('[data-part="bar"]')!.getAttribute('d')!;
  const barX = Number(/M([\d.]+)/.exec(bar)![1]);
  const dotX = Number(svg.querySelector('[data-part="dot"]')!.getAttribute('cx'));
  expect(barX - 0.75).toBeGreaterThanOrEqual(right + 2);
  expect(dotX - 0.75).toBeGreaterThanOrEqual(right + 2);
  const vbW = Number(svg.getAttribute('viewBox')!.split(' ')[2]);
  expect(barX + 0.75).toBeLessThanOrEqual(vbW);
});

test('the "!" is vertically centered on the clock circle', () => {
  const { container } = render(<ConflictIcon />);
  const svg = container.querySelector('svg')!;
  const cy = Number(svg.querySelector('[data-part="clock"]')!.getAttribute('cy'));
  const bar = svg.querySelector('[data-part="bar"]')!.getAttribute('d')!;
  const top = Number(/M[\d.]+ ([\d.]+)/.exec(bar)![1]) - 0.75;
  const dot = svg.querySelector('[data-part="dot"]')!;
  const bottom = Number(dot.getAttribute('cy')) + Number(dot.getAttribute('r'));
  expect(Math.abs((top + bottom) / 2 - cy)).toBeLessThanOrEqual(0.5);
});

test('parts carry conflict-icon__bang and conflict-icon__clock classes', () => {
  const { container } = render(<ConflictIcon />);
  const svg = container.querySelector('svg')!;
  expect(svg.querySelectorAll('.conflict-icon__bang')).toHaveLength(2);
  expect(svg.querySelectorAll('.conflict-icon__clock')).toHaveLength(2);
  expect(svg.querySelector('[data-part="bar"]')!.classList.contains('conflict-icon__bang')).toBe(true);
  expect(svg.querySelector('[data-part="dot"]')!.classList.contains('conflict-icon__bang')).toBe(true);
});

test('the dot has no stroke and its diameter equals the bar stroke width', () => {
  const { container } = render(<ConflictIcon />);
  const svg = container.querySelector('svg')!;
  const dot = svg.querySelector('[data-part="dot"]')!;
  expect(dot.getAttribute('stroke')).toBe('none');
  expect(dot.getAttribute('fill')).toBe('currentColor');
  expect(Number(dot.getAttribute('r')) * 2).toBe(Number(svg.getAttribute('stroke-width')));
});
