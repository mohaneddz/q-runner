import { PLAYER_START_X, PLAYER_START_Y, PLAYER_START_Y_FLIPPED } from "@/game/core/constants";
import { createSimState, type SimState } from "@/game/core/simulation";
import { createLevelContext, type LevelContext } from "@/game/level/levelGeometry";
import type { LevelData, LevelObject } from "@/game/level/levelSchema";
import type { GameMode, Gravity, LevelObjectType } from "@/game/level/objectCatalog";

let counter = 0;

export function object(
  type: LevelObjectType,
  x: number,
  y: number,
  width?: number,
  height?: number,
): LevelObject {
  counter += 1;
  return {
    id: `t${counter}`,
    type,
    x,
    y,
    rotation: 0,
    ...(width === undefined ? {} : { width }),
    ...(height === undefined ? {} : { height }),
  };
}

/** A flat floor from x=0 to `length`, walkable surface at y=1. */
export function ground(length: number): LevelObject {
  return object("spanPlatform", 0, 0, length, 1);
}

export function level(
  objects: LevelObject[],
  overrides: Partial<LevelData["settings"]> = {},
): LevelData {
  const now = "2026-01-01T00:00:00.000Z";
  return {
    version: 1,
    meta: {
      id: "testLevel",
      name: "Test",
      author: "Tests",
      createdAt: now,
      updatedAt: now,
    },
    settings: {
      length: 60,
      baseSpeed: 8,
      startMode: "cube",
      startGravity: 1,
      theme: "neon",
      ...overrides,
    },
    objects,
  };
}

export function contextFor(data: LevelData): LevelContext {
  return createLevelContext(data);
}

export function spawn(mode: GameMode = "cube", gravity: Gravity = 1): SimState {
  return createSimState(
    mode,
    gravity,
    PLAYER_START_X,
    gravity === 1 ? PLAYER_START_Y : PLAYER_START_Y_FLIPPED,
  );
}
