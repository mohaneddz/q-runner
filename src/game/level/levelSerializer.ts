import type { LevelData } from "@/game/level/levelTypes";

export function serializeLevel(level: LevelData): string {
  return JSON.stringify(level, null, 2);
}

export function parseLevel(raw: string): LevelData {
  const parsed = JSON.parse(raw) as LevelData;
  if (!parsed.id || !parsed.name || !Array.isArray(parsed.objects) || typeof parsed.length !== "number") {
    throw new Error("Invalid level format");
  }
  return parsed;
}
