import { formatLevelIssues, safeParseLevel, type LevelData } from "@/game/level/levelSchema";

export function serializeLevel(level: LevelData): string {
  return `${JSON.stringify(level, null, 2)}\n`;
}

export class LevelParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LevelParseError";
  }
}

export function deserializeLevel(raw: string): LevelData {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new LevelParseError("That file is not valid JSON.");
  }

  const parsed = safeParseLevel(json);
  if (!parsed.success) {
    throw new LevelParseError(formatLevelIssues(parsed.error));
  }
  return parsed.data;
}
