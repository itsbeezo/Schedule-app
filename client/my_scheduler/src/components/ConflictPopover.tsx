import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AnchorRect, computePopoverPosition } from './popoverPosition';

interface Props {
  anchor: AnchorRect;
  otherTitle: string;
  state: 'active' | 'ignored';
  mode?: 'once' | 'allow';
  onIgnoreOnce(): void;
  onAllow(): void;
  onRestore(): void;
  onClose(): void;
}

export default function ConflictPopover({ anchor, otherTitle, state, mode, onIgnoreOnce, onAllow, onRestore, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setPos(computePopoverPosition(anchor, { width: el.offsetWidth, height: el.offsetHeight }, { width: window.innerWidth, height: window.innerHeight }));
  }, [anchor]);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>('button')?.focus();
    return () => {
      if (opener?.isConnected) opener.focus();
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return onClose();
      if (e.key !== 'Tab' || !ref.current) return;
      const items = Array.from(ref.current.querySelectorAll<HTMLElement>('button'));
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (!ref.current.contains(active)) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
    };
  }, [onClose]);

  return (
    <div ref={ref} className="popover" role="dialog" aria-label="Conflict options" style={pos ? { left: pos.left, top: pos.top } : { left: 0, top: 0, visibility: 'hidden' }}>
      {state === 'active' ? (
        <>
          <p className="popover__title">Overlaps with {otherTitle}</p>
          <div className="popover__actions">
            <button type="button" className="btn" onClick={onIgnoreOnce}>Ignore this once</button>
            <button type="button" className="btn btn--primary" onClick={onAllow}>Allow overlap</button>
          </div>
        </>
      ) : (
        <>
          <p className="popover__title">
            {mode === 'allow' ? 'Allowed' : 'Ignored'} overlap with {otherTitle}
          </p>
          <div className="popover__actions">
            <button type="button" className="btn" onClick={onRestore}>Restore conflict</button>
          </div>
        </>
      )}
    </div>
  );
}
