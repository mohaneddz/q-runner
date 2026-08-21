/** Snap increments offered in the editor, in world units. */
export const SNAP_SIZES = [1, 0.5, 0.25] as const;

export type SnapSize = (typeof SNAP_SIZES)[number];

export function snapValue(value: number, size: number): number {
  if (size <= 0) {
    return value;
  }
  return Math.round(value / size) * size;
}

export function snapPoint(
  x: number,
  y: number,
  size: number,
): { x: number; y: number } {
  return { x: snapValue(x, size), y: snapValue(y, size) };
}

/** Rounds away floating-point dust so exported JSON stays tidy. */
export function tidy(value: number): number {
  return Math.round(value * 1000) / 1000;
}
