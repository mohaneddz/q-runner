import { storageGet, storageSet, storageValues } from "@/utils/storage";

const PROGRESS_STORE = "progress";

export interface LevelProgress {
  levelId: string;
  /** Furthest fraction of the level ever reached, 0-1. */
  bestProgress: number;
  completed: boolean;
  attempts: number;
  /** Ticks taken by the fastest clear, if any. */
  bestTicks: number | null;
  updatedAt: string;
}

function blank(levelId: string): LevelProgress {
  return {
    levelId,
    bestProgress: 0,
    completed: false,
    attempts: 0,
    bestTicks: null,
    updatedAt: new Date().toISOString(),
  };
}

export async function loadProgress(levelId: string): Promise<LevelProgress> {
  return (await storageGet<LevelProgress>(PROGRESS_STORE, levelId)) ?? blank(levelId);
}

export async function loadAllProgress(): Promise<Record<string, LevelProgress>> {
  const entries = await storageValues<LevelProgress>(PROGRESS_STORE);
  return Object.fromEntries(entries.map((entry) => [entry.levelId, entry]));
}

export interface RunOutcome {
  progress: number;
  completed: boolean;
  ticks: number;
}

/** Folds one finished attempt into the stored record and returns the result. */
export async function recordAttempt(
  levelId: string,
  outcome: RunOutcome,
): Promise<LevelProgress> {
  const current = await loadProgress(levelId);
  const next: LevelProgress = {
    levelId,
    bestProgress: Math.max(current.bestProgress, outcome.progress),
    completed: current.completed || outcome.completed,
    attempts: current.attempts + 1,
    bestTicks: outcome.completed
      ? Math.min(current.bestTicks ?? Number.POSITIVE_INFINITY, outcome.ticks)
      : current.bestTicks,
    updatedAt: new Date().toISOString(),
  };
  await storageSet(PROGRESS_STORE, levelId, next);
  return next;
}
