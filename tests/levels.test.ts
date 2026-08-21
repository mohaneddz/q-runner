import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { GameEngine } from "@/game/core/GameEngine";
import { ReplayInput } from "@/game/input/AgentInput";
import { parseLevel, type LevelData } from "@/game/level/levelSchema";
import { deserializeLevel, serializeLevel } from "@/game/level/levelSerializer";
import { solveLevel } from "@/game/validation/reachabilitySolver";

const levelsDir = path.resolve("src/data/builtinLevels");

const files = fs
  .readdirSync(levelsDir)
  .filter((name) => name.endsWith(".json") && name !== "manifest.json")
  .sort();

function load(file: string): LevelData {
  return parseLevel(JSON.parse(fs.readFileSync(path.join(levelsDir, file), "utf8")));
}

/** Runs an engine to completion and reports how it ended. */
function playOut(engine: GameEngine, maxTicks: number) {
  let status = engine.getStatus();
  for (let tick = 0; tick < maxTicks && status === "running"; tick += 1) {
    status = engine.step().status;
  }
  return { status, snapshot: engine.getSnapshot() };
}

describe("replaying a run", () => {
  const data = load("level01.json");
  const solved = solveLevel(data, { trackPath: true });

  it("rewinds a fixed input sequence on restart", () => {
    const input = new ReplayInput(solved.path!);
    const engine = new GameEngine(data, input);

    assert.equal(playOut(engine, solved.path!.length + 10).status, "finished");

    // Without a rewind the second attempt starts from a spent cursor, gets no
    // input at all, and walks into the first hazard.
    engine.reset();
    assert.equal(playOut(engine, solved.path!.length + 10).status, "finished");
  });

  it("reports a cleared level as 100 percent", () => {
    const engine = new GameEngine(data, new ReplayInput(solved.path!));
    const { status, snapshot } = playOut(engine, solved.path!.length + 10);

    assert.equal(status, "finished");
    // The gate sits short of the nominal length, so raw distance would read
    // about 96% on a run that actually finished.
    assert.equal(snapshot.progress, 1);
  });
});

describe("built-in levels", () => {
  it("ships exactly ten levels plus a manifest", () => {
    assert.equal(files.length, 10);
    assert.ok(fs.existsSync(path.join(levelsDir, "manifest.json")));
  });

  it("has a manifest matching the level files", () => {
    const manifest: { id: string; objectCount: number; length: number }[] = JSON.parse(
      fs.readFileSync(path.join(levelsDir, "manifest.json"), "utf8"),
    );
    assert.equal(manifest.length, files.length);

    for (const entry of manifest) {
      const data = load(`${entry.id}.json`);
      assert.equal(entry.objectCount, data.objects.length, `${entry.id} object count`);
      assert.equal(entry.length, data.settings.length, `${entry.id} length`);
    }
  });

  for (const file of files) {
    describe(file, () => {
      const data = load(file);

      it("has exactly one finish gate", () => {
        const gates = data.objects.filter((object) => object.type === "finishGate");
        assert.equal(gates.length, 1);
      });

      it("starts on solid ground", () => {
        const underSpawn = data.objects.filter(
          (object) => object.x <= 2 && (object.width ?? 1) + object.x >= 2.8 && object.y < 1,
        );
        assert.ok(underSpawn.length > 0, "nothing to stand on at the spawn point");
      });

      it("survives a JSON round trip", () => {
        assert.deepEqual(deserializeLevel(serializeLevel(data)), data);
      });

      // The important one: the solver's route, replayed through the real
      // engine, must actually finish. If these ever diverge, "validated"
      // stops meaning anything.
      it("is cleared by replaying the solver's own route through the engine", () => {
        const solved = solveLevel(data, { trackPath: true });
        assert.equal(solved.solvable, true, "solver found no route");
        assert.ok(solved.path, "solver returned no path");

        const engine = new GameEngine(data, new ReplayInput(solved.path!));
        let status = engine.getStatus();
        for (let tick = 0; tick < solved.path!.length + 10 && status === "running"; tick += 1) {
          status = engine.step().status;
        }

        assert.equal(
          status,
          "finished",
          `engine ended as "${status}" at ${(engine.getSnapshot().progress * 100).toFixed(1)}%`,
        );
      });
    });
  }
});
