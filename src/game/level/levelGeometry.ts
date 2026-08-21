import type { LevelData, LevelObject } from "@/game/level/levelSchema";
import {
  definitionFor,
  type LevelObjectType,
  type ObjectCategory,
} from "@/game/level/objectCatalog";

/**
 * A level object with its footprint filled in from the catalog and its bounds
 * precomputed. Rotation is presentation-only — collision stays axis-aligned,
 * which is what the reachability solver assumes.
 */
export interface ResolvedObject {
  id: string;
  type: LevelObjectType;
  category: ObjectCategory;
  x: number;
  y: number;
  width: number;
  height: number;
  right: number;
  top: number;
  rotation: number;
}

export function resolveObject(object: LevelObject): ResolvedObject {
  const definition = definitionFor(object.type);
  const width = object.width ?? definition.width;
  const height = object.height ?? definition.height;
  return {
    id: object.id,
    type: object.type,
    category: definition.category,
    x: object.x,
    y: object.y,
    width,
    height,
    right: object.x + width,
    top: object.y + height,
    rotation: object.rotation,
  };
}

export function resolveObjects(objects: readonly LevelObject[]): ResolvedObject[] {
  return objects.map(resolveObject);
}

export function overlapsBox(
  ax: number,
  ay: number,
  aWidth: number,
  aHeight: number,
  box: { x: number; y: number; right: number; top: number },
): boolean {
  return ax < box.right && ax + aWidth > box.x && ay < box.top && ay + aHeight > box.y;
}

/**
 * Objects bucketed by whole-unit x so a tick only tests the handful of objects
 * near the player. The solver runs hundreds of thousands of ticks, so the
 * linear scan this replaces was the dominant cost.
 */
export class SpatialIndex {
  private readonly buckets = new Map<number, ResolvedObject[]>();
  private readonly empty: ResolvedObject[] = [];

  constructor(objects: readonly ResolvedObject[]) {
    for (const object of objects) {
      const from = Math.floor(object.x);
      const to = Math.floor(object.right);
      for (let bucket = from; bucket <= to; bucket += 1) {
        const existing = this.buckets.get(bucket);
        if (existing) {
          existing.push(object);
        } else {
          this.buckets.set(bucket, [object]);
        }
      }
    }
  }

  /** Objects whose footprint can touch the span [x, x + width]. */
  near(x: number, width: number): ResolvedObject[] {
    const from = Math.floor(x);
    const to = Math.floor(x + width);
    if (from === to) {
      return this.buckets.get(from) ?? this.empty;
    }

    const result: ResolvedObject[] = [];
    for (let bucket = from; bucket <= to; bucket += 1) {
      const items = this.buckets.get(bucket);
      if (!items) {
        continue;
      }
      for (const item of items) {
        if (!result.includes(item)) {
          result.push(item);
        }
      }
    }
    return result;
  }
}

export interface LevelContext {
  objects: ResolvedObject[];
  index: SpatialIndex;
  length: number;
  baseSpeed: number;
}

export function createLevelContext(level: LevelData): LevelContext {
  const objects = resolveObjects(level.objects);
  return {
    objects,
    index: new SpatialIndex(objects),
    length: level.settings.length,
    baseSpeed: level.settings.baseSpeed,
  };
}
