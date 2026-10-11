import React, { useRef } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { classifySwipe, useSwipe, UseSwipeOptions } from './useSwipe';

describe('classifySwipe', () => {
  test('a quick, long, clearly horizontal move is a swipe; left = next, right = prev', () => {
    expect(classifySwipe(-90, 5, 200)).toBe('next');
    expect(classifySwipe(90, -10, 200)).toBe('prev');
  });
  test('too short, too slow, or too diagonal is not a swipe', () => {
    expect(classifySwipe(-40, 0, 100)).toBeNull();
    expect(classifySwipe(-120, 0, 900)).toBeNull();
    expect(classifySwipe(-100, 60, 200)).toBeNull(); // dx < 2.5*dy
    expect(classifySwipe(5, 150, 200)).toBeNull(); // vertical scroll
  });
  test('exactly at the thresholds counts', () => {
    expect(classifySwipe(-60, 24, 700)).toBe('next');
  });
});

function Harness(props: Omit<UseSwipeOptions, 'onSwipe'> & { onSwipe: UseSwipeOptions['onSwipe'] }) {
  const ref = useRef<HTMLDivElement>(null);
  useSwipe(ref, props);
  return (
    <div ref={ref} data-testid="area">
      <div className="fc-event" data-testid="evt" />
      <div data-testid="slot" />
    </div>
  );
}

const touch = (x: number, y: number) => ({ touches: [{ clientX: x, clientY: y }], changedTouches: [{ clientX: x, clientY: y }] });
const end = (x: number, y: number) => ({ touches: [], changedTouches: [{ clientX: x, clientY: y }] });

function swipe(el: Element, from: [number, number], to: [number, number]) {
  fireEvent.touchStart(el, touch(...from));
  fireEvent.touchMove(el, touch(...to));
  fireEvent.touchEnd(el, end(...to));
}

describe('useSwipe', () => {
  test('fires onSwipe for a horizontal swipe', () => {
    const onSwipe = jest.fn();
    render(<Harness onSwipe={onSwipe} />);
    swipe(screen.getByTestId('slot'), [200, 100], [80, 105]);
    expect(onSwipe).toHaveBeenCalledWith('next');
    swipe(screen.getByTestId('slot'), [80, 100], [200, 100]);
    expect(onSwipe).toHaveBeenLastCalledWith('prev');
  });
  test('does not fire for vertical scrolls or short moves', () => {
    const onSwipe = jest.fn();
    render(<Harness onSwipe={onSwipe} />);
    swipe(screen.getByTestId('slot'), [200, 100], [190, 400]);
    swipe(screen.getByTestId('slot'), [200, 100], [170, 100]);
    expect(onSwipe).not.toHaveBeenCalled();
  });
  test('a vertical scroll that later wobbles sideways does not fire', () => {
    const onSwipe = jest.fn();
    render(<Harness onSwipe={onSwipe} />);
    const el = screen.getByTestId('slot');
    fireEvent.touchStart(el, touch(200, 100));
    fireEvent.touchMove(el, touch(198, 160));
    fireEvent.touchEnd(el, end(60, 170));
    expect(onSwipe).not.toHaveBeenCalled();
  });
  test('ignores gestures that start where ignoreStart says (event blocks) and while busy', () => {
    const onSwipe = jest.fn();
    let busy = false;
    render(<Harness onSwipe={onSwipe} ignoreStart={(t) => !!(t as Element).closest('.fc-event')} isBusy={() => busy} />);
    swipe(screen.getByTestId('evt'), [200, 100], [80, 100]);
    expect(onSwipe).not.toHaveBeenCalled();
    busy = true;
    swipe(screen.getByTestId('slot'), [200, 100], [80, 100]);
    expect(onSwipe).not.toHaveBeenCalled();
    busy = false;
    fireEvent.touchStart(screen.getByTestId('slot'), touch(200, 100));
    busy = true; // a drag/select began mid-gesture
    fireEvent.touchEnd(screen.getByTestId('slot'), end(80, 100));
    expect(onSwipe).not.toHaveBeenCalled();
  });
  test('ignores multi-touch and does nothing when disabled', () => {
    const onSwipe = jest.fn();
    const { rerender } = render(<Harness onSwipe={onSwipe} />);
    fireEvent.touchStart(screen.getByTestId('slot'), { touches: [{ clientX: 200, clientY: 100 }, { clientX: 10, clientY: 10 }] });
    fireEvent.touchEnd(screen.getByTestId('slot'), end(80, 100));
    expect(onSwipe).not.toHaveBeenCalled();
    rerender(<Harness onSwipe={onSwipe} enabled={false} />);
    swipe(screen.getByTestId('slot'), [200, 100], [80, 100]);
    expect(onSwipe).not.toHaveBeenCalled();
  });
  test('a slow press-and-move (long-press drag) is not a swipe', () => {
    const onSwipe = jest.fn();
    const now = jest.spyOn(Date, 'now');
    render(<Harness onSwipe={onSwipe} />);
    now.mockReturnValue(1000);
    fireEvent.touchStart(screen.getByTestId('slot'), touch(200, 100));
    now.mockReturnValue(2000);
    fireEvent.touchEnd(screen.getByTestId('slot'), end(80, 100));
    expect(onSwipe).not.toHaveBeenCalled();
    now.mockRestore();
  });
});
