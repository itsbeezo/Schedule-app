import { contrastRatio, hexToRgb, readableTextOn } from '../contrast';

test('black on white is 21:1 and identical colors are 1:1', () => {
  expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 1);
  expect(contrastRatio('#4A63F0', '#4A63F0')).toBeCloseTo(1, 5);
});

test('contrast is symmetric', () => {
  expect(contrastRatio('#14102A', '#EFEAFF')).toBeCloseTo(contrastRatio('#EFEAFF', '#14102A'), 5);
});

test('hexToRgb parses #RRGGBB and rejects anything else', () => {
  expect(hexToRgb('#4DF5C0')).toEqual([77, 245, 192]);
  expect(() => hexToRgb('red')).toThrow();
});

test('readableTextOn picks white on dark backgrounds and dark text on light ones', () => {
  expect(readableTextOn('#1E1840')).toBe('#FFFFFF');
  expect(readableTextOn('#4DF5C0')).toBe('#14102A');
});
