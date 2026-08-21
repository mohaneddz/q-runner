import { nanoid } from "nanoid";
import { loadBuiltinLevel, isBuiltinLevel } from "@/game/level/builtinLevels";
import { parseLevel, type LevelData } from "@/game/level/levelSchema";
import { storageGet, storageRemove, storageSet, storageValues } from "@/utils/storage";

const LEVEL_STORE = "levels";

export async function saveLevel(level: LevelData): Promise<void> {
  const stamped: LevelData = {
    ...level,
    meta: { ...level.meta, updatedAt: new Date().toISOString() },
  };
  await storageSet(LEVEL_STORE, stamped.meta.id, stamped);
}

export async function loadSavedLevel(id: string): Promise<LevelData | null> {
  const raw = await storageGet<unknown>(LEVEL_STORE, id);
  if (!raw) {
    return null;
  }
  try {
    return parseLevel(raw);
  } catch {
    // A level saved by an older format is not worth crashing the app over.
    return null;
  }
}

export async function listSavedLevels(): Promise<LevelData[]> {
  const raw = await storageValues<unknown>(LEVEL_STORE);
  const levels: LevelData[] = [];
  for (const entry of raw) {
    try {
      levels.push(parseLevel(entry));
    } catch {
      continue;
    }
  }
  return levels.sort((a, b) => b.meta.updatedAt.localeCompare(a.meta.updatedAt));
}

export async function deleteSavedLevel(id: string): Promise<void> {
  await storageRemove(LEVEL_STORE, id);
}

/** Saved levels win over built-ins, so a user can shadow one while editing. */
export async function loadLevelById(id: string): Promise<LevelData | null> {
  const saved = await loadSavedLevel(id);
  if (saved) {
    return saved;
  }
  return isBuiltinLevel(id) ? loadBuiltinLevel(id) : null;
}

export function duplicateLevel(level: LevelData, name?: string): LevelData {
  const now = new Date().toISOString();
  return {
    ...level,
    meta: {
      ...level.meta,
      id: `user${nanoid(8)}`,
      name: name ?? `${level.meta.name} copy`,
      createdAt: now,
      updatedAt: now,
    },
  };
}
