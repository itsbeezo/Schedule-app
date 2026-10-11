export interface AnchorRect { left: number; top: number; bottom: number }

const MARGIN = 8;
const GAP = 4;

/** Places a popover below its anchor (the event block), flips above when there is no room below, and
 * clamps horizontally using the popover's real measured size. */
export function computePopoverPosition(
  anchor: AnchorRect,
  size: { width: number; height: number },
  viewport: { width: number; height: number },
): { top: number; left: number } {
  const maxLeft = Math.max(MARGIN, viewport.width - size.width - MARGIN);
  const left = Math.max(MARGIN, Math.min(anchor.left, maxLeft));
  const below = anchor.bottom + GAP;
  const above = anchor.top - GAP - size.height;
  let top: number;
  if (below + size.height + MARGIN <= viewport.height) top = below;
  else if (above >= MARGIN) top = above;
  else top = Math.max(MARGIN, viewport.height - size.height - MARGIN);
  return { top, left };
}
