import { safeParseLevel } from "@/game/level/levelSchema";
import { solveLevel, type SolverResult } from "@/game/validation/reachabilitySolver";

export interface SolverRequest {
  id: number;
  level: unknown;
  trackPath?: boolean;
}

export type SolverResponse =
  | { id: number; ok: true; result: SolverResult }
  | { id: number; ok: false; error: string };

self.addEventListener("message", (event: MessageEvent<SolverRequest>) => {
  const { id, level, trackPath } = event.data;
  const parsed = safeParseLevel(level);

  if (!parsed.success) {
    const response: SolverResponse = { id, ok: false, error: "Level failed validation." };
    self.postMessage(response);
    return;
  }

  try {
    const result = solveLevel(parsed.data, { trackPath });
    const response: SolverResponse = { id, ok: true, result };
    self.postMessage(response);
  } catch (error) {
    const response: SolverResponse = {
      id,
      ok: false,
      error: error instanceof Error ? error.message : "Solver failed.",
    };
    self.postMessage(response);
  }
});
