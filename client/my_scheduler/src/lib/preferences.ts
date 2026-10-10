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
