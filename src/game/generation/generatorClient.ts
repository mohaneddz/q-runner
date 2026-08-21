import type { GenerateRequest, GenerateResponse } from "@/game/generation/generator.worker";
import { generateLevel, type GenerateLevelOptions } from "@/game/generation/levelGenerator";
import type { LevelData } from "@/game/level/levelSchema";

let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<number, (response: GenerateResponse) => void>();

function ensureWorker(): Worker | null {
  if (typeof window === "undefined" || typeof Worker === "undefined") {
    return null;
  }
  if (worker) {
    return worker;
  }

  try {
    worker = new Worker(new URL("./generator.worker.ts", import.meta.url));
    worker.addEventListener("message", (event: MessageEvent<GenerateResponse>) => {
      const resolve = pending.get(event.data.id);
      if (resolve) {
        pending.delete(event.data.id);
        resolve(event.data);
      }
    });
    worker.addEventListener("error", () => {
      for (const [id, resolve] of pending) {
        resolve({ id, ok: false, error: "Generator worker crashed." });
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
 * Generating a level runs the solver over every candidate chunk, which takes
 * seconds. Off the main thread the endless screen stays interactive and the
 * next run can be built while the current one is being played.
 */
export function generateLevelAsync(options: GenerateLevelOptions): Promise<LevelData> {
  const instance = ensureWorker();
  if (!instance) {
    return Promise.resolve(generateLevel(options));
  }

  const id = nextId++;
  const request: GenerateRequest = { id, options };

  return new Promise<LevelData>((resolve, reject) => {
    pending.set(id, (response) => {
      if (response.ok) {
        resolve(response.level);
      } else {
        reject(new Error(response.error));
      }
    });
    instance.postMessage(request);
  });
}
