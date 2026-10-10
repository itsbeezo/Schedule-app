import { getDefaultEventColor, setDefaultEventColor, DEFAULT_SCROLL_TIME, getScrollTime, setScrollTime } from './preferences';

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

describe('scroll time preference', () => {
  test('defaults to 07:00:00', () => {
    expect(DEFAULT_SCROLL_TIME).toBe('07:00:00');
    expect(getScrollTime()).toBe('07:00:00');
  });

  test('round trips and clears', () => {
    setScrollTime('06:30');
    expect(getScrollTime()).toBe('06:30');
    setScrollTime('08:15:00');
    expect(getScrollTime()).toBe('08:15:00');
    setScrollTime(null);
    expect(getScrollTime()).toBe('07:00:00');
  });

  test.each(['', 'abc', '25:00', '07:60', '7:00', '07:00:61', '24:00'])('invalid stored value %p falls back to default', (bad) => {
    localStorage.setItem('schedule.scrollTime', bad);
    expect(getScrollTime()).toBe('07:00:00');
  });

  test('invalid input to setScrollTime is ignored without throwing', () => {
    setScrollTime('09:00');
    expect(() => setScrollTime('nope')).not.toThrow();
    expect(getScrollTime()).toBe('09:00');
  });

  test('never throws when storage is blocked', () => {
    const get = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(getScrollTime()).toBe('07:00:00');
    get.mockRestore();
    const set = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('full'); });
    expect(() => setScrollTime('08:00')).not.toThrow();
    set.mockRestore();
    const rm = jest.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('x'); });
    expect(() => setScrollTime(null)).not.toThrow();
    rm.mockRestore();
  });
});
