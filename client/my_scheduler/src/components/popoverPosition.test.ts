import { computePopoverPosition } from './popoverPosition';

const vp = { width: 1280, height: 800 };
const size = { width: 300, height: 120 };

test('opens below the anchor when it fits', () => {
  expect(computePopoverPosition({ left: 100, top: 100, bottom: 160 }, size, vp)).toEqual({ top: 164, left: 100 });
});

test('flips above the anchor when there is no room below', () => {
  const p = computePopoverPosition({ left: 100, top: 600, bottom: 700 }, size, vp);
  expect(p.top).toBe(600 - 4 - 120);
});

test('clamps horizontally using the real width', () => {
  expect(computePopoverPosition({ left: 1200, top: 100, bottom: 160 }, size, vp).left).toBe(1280 - 300 - 8);
  expect(computePopoverPosition({ left: 1200, top: 100, bottom: 160 }, { width: 200, height: 120 }, vp).left).toBe(1280 - 200 - 8);
  expect(computePopoverPosition({ left: -20, top: 100, bottom: 160 }, size, vp).left).toBe(8);
});

test('narrow viewport keeps the margin and stays inside', () => {
  const p = computePopoverPosition({ left: 300, top: 100, bottom: 160 }, { width: 358, height: 120 }, { width: 390, height: 844 });
  expect(p.left).toBe(390 - 358 - 8);
  expect(p.top).toBe(164);
});

test('neither side fits: pinned inside the viewport', () => {
  const p = computePopoverPosition({ left: 0, top: 20, bottom: 380 }, { width: 300, height: 400 }, { width: 1280, height: 420 });
  expect(p.top).toBe(12);
});
