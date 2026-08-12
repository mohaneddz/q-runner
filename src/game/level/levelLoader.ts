import { nanoid } from "nanoid";
import { GROUND_Y, GRID_SIZE } from "@/game/core/constants";
import type { LevelData } from "@/game/level/levelTypes";

function platform(id: string, x: number, width: number, y = GROUND_Y, height = 100) {
  return { id, type: "platform" as const, x, y, width, height };
}

function spike(id: string, x: number, size = GRID_SIZE) {
  return { id, type: "spike" as const, x, y: GROUND_Y - size, width: size, height: size };
}

export const DEFAULT_LEVEL: LevelData = {
  id: "default-level",
  name: "Neon Trial",
  length: 5200,
  objects: [
    platform("p0", 0, 1000),
    spike("s1", 520),
    spike("s2", 700),
    platform("p1", 1120, 600),
    spike("s3", 1240),
    spike("s4", 1336),
    platform("p2", 1840, 500),
    platform("p3", 2480, 420),
    spike("s5", 2580),
    spike("s6", 2676),
    platform("p4", 3020, 300),
    platform("p5", 3500, 440),
    spike("s7", 3600),
    spike("s8", 3696),
    spike("s9", 3792),
    platform("p6", 4120, 320),
    platform("p7", 4600, 520),
  ],
};

export async function loadDefaultLevel(): Promise<LevelData> {
  return JSON.parse(JSON.stringify(DEFAULT_LEVEL));
}

export function createBlankLevel(): LevelData {
  return {
    id: `level-${nanoid(6)}`,
    name: "Untitled",
    length: 4000,
    objects: [platform("base", 0, 1200)],
  };
}
