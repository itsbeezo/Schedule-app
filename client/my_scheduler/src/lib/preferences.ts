const KEY = 'schedule.defaultEventColor';

export function getDefaultEventColor(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function setDefaultEventColor(color: string | null): void {
  try {
    if (color) localStorage.setItem(KEY, color);
    else localStorage.removeItem(KEY);
  } catch {
    /* storage unavailable: the preference simply does not persist */
  }
}

const SCROLL_KEY = 'schedule.scrollTime';
export const DEFAULT_SCROLL_TIME = '07:00:00';

function isTimeOfDay(t: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(t);
}

export function getScrollTime(): string {
  try {
    const v = localStorage.getItem(SCROLL_KEY);
    return v !== null && isTimeOfDay(v) ? v : DEFAULT_SCROLL_TIME;
  } catch {
    return DEFAULT_SCROLL_TIME;
  }
}

export function setScrollTime(time: string | null): void {
  try {
    if (time === null) localStorage.removeItem(SCROLL_KEY);
    else if (isTimeOfDay(time)) localStorage.setItem(SCROLL_KEY, time);
  } catch {
    /* storage unavailable: the preference simply does not persist */
  }
}
