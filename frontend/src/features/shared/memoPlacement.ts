export type MemoCorner = 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
type Rect = { left: number; right: number; top: number; bottom: number };

/** All four placements pivot at the SAME point: the center of the memo button. */
export function memoPlacement(
  anchor: Rect,
  size: { width: number; height: number },
  viewport: { width: number; height: number; left?: number; top?: number },
  preferred: MemoCorner = 'top-right',
) {
  const margin = 12;
  const left = (viewport.left ?? 0) + margin;
  const top = (viewport.top ?? 0) + margin;
  const right = (viewport.left ?? 0) + viewport.width - margin;
  const bottom = (viewport.top ?? 0) + viewport.height - margin;
  const x = Math.max(left, Math.min((anchor.left + anchor.right) / 2, right));
  const y = Math.max(top, Math.min((anchor.top + anchor.bottom) / 2, bottom));
  const toLeft = x - left;
  const toRight = right - x;
  const below = bottom - y;
  const above = y - top;
  let alignRight = preferred.endsWith('right');
  if (
    (alignRight ? toLeft : toRight) < size.width &&
    (alignRight ? toRight > toLeft : toLeft > toRight)
  )
    alignRight = !alignRight;
  let down = preferred.startsWith('top');
  if ((down ? below : above) < size.height && (down ? above > below : below > above)) down = !down;
  const width = Math.min(size.width, alignRight ? toLeft : toRight);
  const maxHeight = down ? below : above;
  const height = Math.min(size.height, maxHeight);
  return {
    left: alignRight ? x - width : x,
    top: down ? y : y - height,
    width,
    maxHeight,
    corner: `${down ? 'top' : 'bottom'}-${alignRight ? 'right' : 'left'}` as MemoCorner,
  };
}
