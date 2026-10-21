export interface TileLayout {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function findDropTarget(
  layouts: Array<TileLayout | undefined>,
  fromIndex: number,
  centerX: number,
  centerY: number,
): number {
  let best = fromIndex;
  let bestDistance = Number.POSITIVE_INFINITY;
  layouts.forEach((layout, index) => {
    if (!layout) return;
    const distance = Math.hypot(
      layout.x + layout.width / 2 - centerX,
      layout.y + layout.height / 2 - centerY,
    );
    if (distance < bestDistance) {
      bestDistance = distance;
      best = index;
    }
  });
  return best;
}

export function reorderWordIds(ids: number[], from: number, to: number): number[] {
  if (from === to || from < 0 || to < 0 || from >= ids.length || to >= ids.length) return ids;
  const next = [...ids];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}
