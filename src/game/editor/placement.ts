import { nanoid } from "nanoid";
import { GRID_SIZE } from "@/game/core/constants";
import type { LevelObject, LevelObjectType } from "@/game/level/levelTypes";
import { snapPoint } from "@/game/editor/grid";

export function createPlacedObject(type: LevelObjectType, worldX: number, worldY: number): LevelObject {
  const { x, y } = snapPoint(worldX, worldY, GRID_SIZE);
  if (type === "spike") {
    return {
      id: nanoid(8),
      type,
      x,
      y,
      width: GRID_SIZE,
      height: GRID_SIZE,
    };
  }

  return {
    id: nanoid(8),
    type,
    x,
    y,
    width: GRID_SIZE * 4,
    height: GRID_SIZE,
  };
}
