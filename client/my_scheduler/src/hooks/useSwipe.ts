import { RefObject, useEffect, useRef } from 'react';

export type SwipeDirection = 'next' | 'prev';

export interface SwipeConfig {
  /** Minimum horizontal travel in px. */
  minDistance: number;
  /** Longest gesture that still counts as a swipe (ms); slower presses are drags / long-presses. */
  maxDuration: number;
  /** |dx| must be at least this many times |dy| (direction lock). */
  directionRatio: number;
}

export const DEFAULT_SWIPE: SwipeConfig = { minDistance: 60, maxDuration: 700, directionRatio: 2.5 };

/** Decide whether a finished touch is a horizontal swipe. Swiping left (dx < 0) goes to the next day. */
export function classifySwipe(dx: number, dy: number, durationMs: number, cfg: SwipeConfig = DEFAULT_SWIPE): SwipeDirection | null {
  if (durationMs > cfg.maxDuration) return null;
  if (Math.abs(dx) < cfg.minDistance) return null;
  if (Math.abs(dx) < Math.abs(dy) * cfg.directionRatio) return null;
  return dx < 0 ? 'next' : 'prev';
}

export interface UseSwipeOptions {
  onSwipe: (dir: SwipeDirection) => void;
  enabled?: boolean;
  /** True if a gesture starting on this element must not be treated as a swipe (e.g. an event block). */
  ignoreStart?: (target: EventTarget | null) => boolean;
  /** True while something else owns the gesture (dragging, resizing, selecting). Checked during and at the end. */
  isBusy?: () => boolean;
  config?: SwipeConfig;
}

/** Calls onSwipe for quick, clearly horizontal single-finger swipes inside `ref`. Never prevents default, so scrolling is untouched. */
export function useSwipe(ref: RefObject<HTMLElement | null>, opts: UseSwipeOptions) {
  const latest = useRef(opts);
  latest.current = opts;
  const enabled = opts.enabled !== false;

  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;
    let start: { x: number; y: number; t: number } | null = null;

    const cancel = () => { start = null; };
    const onStart = (e: TouchEvent) => {
      const { ignoreStart, isBusy } = latest.current;
      if (e.touches.length !== 1 || ignoreStart?.(e.target) || isBusy?.()) return cancel();
      const t = e.touches[0];
      start = { x: t.clientX, y: t.clientY, t: Date.now() };
    };
    const onMove = (e: TouchEvent) => {
      if (!start) return;
      if (e.touches.length !== 1 || latest.current.isBusy?.()) return cancel();
      const t = e.touches[0];
      const cfg = latest.current.config ?? DEFAULT_SWIPE;
      // A mostly-vertical drag is a scroll: stop tracking so a later sideways wobble cannot flip the day.
      if (Math.abs(t.clientY - start.y) > 12 && Math.abs(t.clientX - start.x) < Math.abs(t.clientY - start.y) * cfg.directionRatio) cancel();
    };
    const onEnd = (e: TouchEvent) => {
      const s = start;
      start = null;
      if (!s || latest.current.isBusy?.()) return;
      const t = e.changedTouches[0];
      if (!t) return;
      const dir = classifySwipe(t.clientX - s.x, t.clientY - s.y, Date.now() - s.t, latest.current.config);
      if (dir) latest.current.onSwipe(dir);
    };

    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: true });
    el.addEventListener('touchend', onEnd, { passive: true });
    el.addEventListener('touchcancel', cancel, { passive: true });
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('touchcancel', cancel);
    };
  }, [ref, enabled]);
}
