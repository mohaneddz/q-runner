import type { LevelData } from "@/game/level/levelSchema";
import { solveLevel, type SolverResult } from "@/game/validation/reachabilitySolver";
import type { SolverRequest, SolverResponse } from "@/game/validation/solver.worker";

let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<number, (response: SolverResponse) => void>();

function ensureWorker(): Worker | null {
  if (typeof window === "undefined" || typeof Worker === "undefined") {
    return null;
  }
  if (worker) {
    return worker;
  }

  try {
    worker = new Worker(new URL("./solver.worker.ts", import.meta.url));
    worker.addEventListener("message", (event: MessageEvent<SolverResponse>) => {
      const resolve = pending.get(event.data.id);
      if (resolve) {
        pending.delete(event.data.id);
        resolve(event.data);
      }
    });
    worker.addEventListener("error", () => {
      // Fall back to the main thread rather than leaving callers hanging.
      for (const [id, resolve] of pending) {
        resolve({ id, ok: false, error: "Solver worker crashed." });
      }
      pending.clear();
      worker = null;
    });
  } catch {
    worker = null;
  }

  return worker;
}

/**
 * Solving a full level takes seconds, which would lock the editor. Run it in a
 * worker where available and fall back to a blocking solve otherwise.
 */
export function solveLevelAsync(level: LevelData, trackPath = false): Promise<SolverResult> {
  const instance = ensureWorker();
  if (!instance) {
    return Promise.resolve(solveLevel(level, { trackPath }));
  }

  const id = nextId++;
  const request: SolverRequest = { id, level, trackPath };

  return new Promise<SolverResult>((resolve, reject) => {
    pending.set(id, (response) => {
      if (response.ok) {
        resolve(response.result);
      } else {
        reject(new Error(response.error));
      }
    });
    instance.postMessage(request);
  });
}
