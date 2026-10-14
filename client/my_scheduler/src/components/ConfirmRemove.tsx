import React, { useEffect, useRef, useState } from 'react';

interface Props {
  /** Visible text of the trigger button, e.g. "Remove". */
  label: string;
  /** Accessible name of the trigger button; defaults to `label`. */
  ariaLabel?: string;
  /** Names the confirmation group, e.g. "Remove zone Mon 9:00 AM?". */
  groupLabel: string;
  confirmLabel?: string;
  className?: string;
  onConfirm(): void;
}

/** A remove button that asks "Remove? [Yes, remove] [Cancel]" in place before doing anything. */
export default function ConfirmRemove({ label, ariaLabel, groupLabel, confirmLabel = 'Yes, remove', className = 'btn btn--ghost', onConfirm }: Props) {
  const [asking, setAsking] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef(false);

  useEffect(() => {
    if (asking) cancelRef.current?.focus();
    else if (returnFocus.current) {
      returnFocus.current = false;
      triggerRef.current?.focus();
    }
  }, [asking]);

  function cancel() {
    returnFocus.current = true;
    setAsking(false);
  }

  if (!asking) {
    return (
      <button ref={triggerRef} type="button" className={className} aria-label={ariaLabel} onClick={() => setAsking(true)}>
        {label}
      </button>
    );
  }
  return (
    <span
      role="group"
      aria-label={groupLabel}
      style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          e.nativeEvent.stopImmediatePropagation();
          cancel();
        }
      }}
    >
      <span>Remove?</span>
      <button type="button" className={className} onClick={onConfirm}>{confirmLabel}</button>
      <button ref={cancelRef} type="button" className={className} onClick={cancel}>Cancel</button>
    </span>
  );
}
