import manifest from "@/data/builtinLevels/manifest.json";
import { parseLevel, type LevelData } from "@/game/level/levelSchema";
import type { GameMode } from "@/game/level/objectCatalog";

export interface LevelSummary {
  id: string;
  name: string;
  author: string;
  theme: string;
  length: number;
  baseSpeed: number;
  objectCount: number;
  tier: number;
  modes: GameMode[];
  hasGravityFlips: boolean;
}

export const BUILTIN_LEVELS = manifest as LevelSummary[];

/**
 * A static map rather than a computed path so the bundler can split each level
 * into its own chunk — the picker only needs the manifest, and a run only
 * needs the one level being played.
 */
const LEVEL_LOADERS: Record<string, () => Promise<{ default: unknown }>> = {
  level01: () => import("@/data/builtinLevels/level01.json"),
  level02: () => import("@/data/builtinLevels/level02.json"),
  level03: () => import("@/data/builtinLevels/level03.json"),
  level04: () => import("@/data/builtinLevels/level04.json"),
  level05: () => import("@/data/builtinLevels/level05.json"),
  level06: () => import("@/data/builtinLevels/level06.json"),
  level07: () => import("@/data/builtinLevels/level07.json"),
  level08: () => import("@/data/builtinLevels/level08.json"),
  level09: () => import("@/data/builtinLevels/level09.json"),
  level10: () => import("@/data/builtinLevels/level10.json"),
};

export function isBuiltinLevel(id: string): boolean {
  return id in LEVEL_LOADERS;
}

export async function loadBuiltinLevel(id: string): Promise<LevelData | null> {
  const loader = LEVEL_LOADERS[id];
  if (!loader) {
    return null;
  }
  const loaded = await loader();
  return parseLevel(loaded.default);
}

export function summaryFor(id: string): LevelSummary | null {
  return BUILTIN_LEVELS.find((level) => level.id === id) ?? null;
}

export function nextLevelId(id: string): string | null {
  const index = BUILTIN_LEVELS.findIndex((level) => level.id === id);
  if (index === -1 || index + 1 >= BUILTIN_LEVELS.length) {
    return null;
  }
  return BUILTIN_LEVELS[index + 1].id;
}

export const FIRST_LEVEL_ID = BUILTIN_LEVELS[0]?.id ?? "level01";
