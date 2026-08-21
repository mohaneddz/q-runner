import { nanoid } from "nanoid";
import { snapPoint, tidy } from "@/game/editor/grid";
import type { LevelObject } from "@/game/level/levelSchema";
import { definitionFor, type LevelObjectType } from "@/game/level/objectCatalog";

export function createObjectId(): string {
  return `o${nanoid(8)}`;
}

/**
 * Places an object with its catalog footprint, anchored so the cursor sits at
 * the object's bottom-left cell rather than its centre — which is how a grid
 * editor is expected to behave.
 */
export function createPlacedObject(
  type: LevelObjectType,
  worldX: number,
  worldY: number,
  snap: number,
): LevelObject {
  const definition = definitionFor(type);
  const { x, y } = snapPoint(worldX, worldY, snap);

  return {
    id: createObjectId(),
    type,
    x: tidy(x),
    y: tidy(y),
    rotation: 0,
    width: definition.width,
    height: definition.height,
  };
}

export function duplicateObjects(objects: LevelObject[], offsetX: number): LevelObject[] {
  return objects.map((object) => ({
    ...object,
    id: createObjectId(),
    x: tidy(object.x + offsetX),
  }));
}
