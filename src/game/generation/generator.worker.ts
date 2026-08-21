import { generateLevel, type GenerateLevelOptions } from "@/game/generation/levelGenerator";
import type { LevelData } from "@/game/level/levelSchema";

export interface GenerateRequest {
  id: number;
  options: GenerateLevelOptions;
}

export type GenerateResponse =
  | { id: number; ok: true; level: LevelData }
  | { id: number; ok: false; error: string };

self.addEventListener("message", (event: MessageEvent<GenerateRequest>) => {
  const { id, options } = event.data;
  try {
    const level = generateLevel(options);
    const response: GenerateResponse = { id, ok: true, level };
    self.postMessage(response);
  } catch (error) {
    const response: GenerateResponse = {
      id,
      ok: false,
      error: error instanceof Error ? error.message : "Generation failed.",
    };
    self.postMessage(response);
  }
});
