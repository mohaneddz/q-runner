import { GRID_SIZE } from "@/game/core/constants";

export function snapToGrid(value: number, size = GRID_SIZE): number {
  return Math.round(value / size) * size;
}

export function snapPoint(x: number, y: number, size = GRID_SIZE): { x: number; y: number } {
  return { x: snapToGrid(x, size), y: snapToGrid(y, size) };
}
