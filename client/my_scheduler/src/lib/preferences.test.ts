import { getDefaultEventColor, setDefaultEventColor } from './preferences';

afterEach(() => localStorage.clear());

test('stores and returns the default event color', () => {
  expect(getDefaultEventColor()).toBeNull();
  setDefaultEventColor('#4A63F0');
  expect(getDefaultEventColor()).toBe('#4A63F0');
  setDefaultEventColor(null);
  expect(getDefaultEventColor()).toBeNull();
});

test('never throws when storage is blocked', () => {
  const spy = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
  expect(getDefaultEventColor()).toBeNull();
  spy.mockRestore();
  const set = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('full'); });
  expect(() => setDefaultEventColor('#4A63F0')).not.toThrow();
  set.mockRestore();
});
