import { storageGet, storageKeys, storageRemove, storageSet } from "@/utils/storage";
import { loadDefaultLevel } from "@/game/level/levelLoader";
import { parseLevel, serializeLevel } from "@/game/level/levelSerializer";
import type { LevelData } from "@/game/level/levelTypes";

const LEVEL_PREFIX = "level:";

export async function saveLevel(level: LevelData): Promise<void> {
  await storageSet(`${LEVEL_PREFIX}${level.id}`, level);
}

export async function loadLevel(levelId: string): Promise<LevelData | null> {
  return storageGet<LevelData>(`${LEVEL_PREFIX}${levelId}`);
}

export async function loadLevelOrDefault(levelId?: string): Promise<LevelData> {
  if (!levelId) {
    return loadDefaultLevel();
  }

  const level = await loadLevel(levelId);
  return level ?? loadDefaultLevel();
}

export async function listSavedLevels(): Promise<LevelData[]> {
  const keys = await storageKeys();
  const levelKeys = keys.filter((key) => key.startsWith(LEVEL_PREFIX));
  const levels = await Promise.all(levelKeys.map((key) => storageGet<LevelData>(key)));
  return levels.filter((level): level is LevelData => Boolean(level));
}

export async function deleteLevel(levelId: string): Promise<void> {
  await storageRemove(`${LEVEL_PREFIX}${levelId}`);
}

export function exportLevel(level: LevelData): string {
  return serializeLevel(level);
}

export function importLevel(raw: string): LevelData {
  return parseLevel(raw);
}
