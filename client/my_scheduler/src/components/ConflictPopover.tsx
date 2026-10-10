import React, { useEffect, useRef } from 'react';

interface Props {
  x: number;
  y: number;
  otherTitle: string;
  state: 'active' | 'ignored';
  mode?: 'once' | 'allow';
  onIgnoreOnce(): void;
  onAllow(): void;
  onRestore(): void;
  onClose(): void;
}

export default function ConflictPopover({ x, y, otherTitle, state, mode, onIgnoreOnce, onAllow, onRestore, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
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

  const left = Math.max(8, Math.min(x, window.innerWidth - 316));
  const top = Math.max(8, Math.min(y + 8, window.innerHeight - 180));

  return (
    <div ref={ref} className="popover" role="dialog" aria-label="Conflict options" style={{ left, top }}>
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
