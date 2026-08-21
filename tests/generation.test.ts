import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { GameEngine } from "@/game/core/GameEngine";
import { createEndlessStage } from "@/game/generation/endless";
import { generateLevel } from "@/game/generation/levelGenerator";
import { ReplayInput } from "@/game/input/AgentInput";
import { levelSchema } from "@/game/level/levelSchema";
import { isSolvable, solveLevel } from "@/game/validation/reachabilitySolver";
import { Random } from "@/utils/random";

describe("level generation", () => {
  it("produces schema-valid, solvable levels", () => {
    const level = generateLevel({
      seed: 4242,
      name: "Generated",
      targetLength: 110,
      theme: "neon",
      difficultyFrom: 0.2,
      difficultyTo: 0.5,
    });

    assert.equal(levelSchema.safeParse(level).success, true);
    assert.equal(level.objects.filter((object) => object.type === "finishGate").length, 1);
    assert.equal(isSolvable(level), true);
  });

  it("is reproducible from its seed", () => {
    const options = {
      seed: 99,
      name: "Repeat",
      targetLength: 90,
      theme: "void" as const,
      difficultyFrom: 0.3,
      difficultyTo: 0.6,
      timestamp: "2026-01-01T00:00:00.000Z",
      id: "repeat",
    };

    // Byte-identical, not merely equivalent: regenerating the built-in levels
    // must not produce a diff.
    assert.equal(
      JSON.stringify(generateLevel(options)),
      JSON.stringify(generateLevel(options)),
    );
  });

  it("honours the requested mode plan", () => {
    const level = generateLevel({
      seed: 777,
      name: "Modes",
      targetLength: 160,
      theme: "circuit",
      difficultyFrom: 0.4,
      difficultyTo: 0.6,
      sections: [
        { mode: "cube", weight: 1 },
        { mode: "ship", weight: 1 },
        { mode: "cube", weight: 1 },
      ],
    });

    const types = new Set(level.objects.map((object) => object.type));
    assert.ok(types.has("shipPortal"), "no ship section was generated");
    assert.ok(types.has("cubePortal"), "never returned to cube");
  });

  it("merges runs of solids without changing what is reachable", () => {
    const level = generateLevel({
      seed: 31337,
      name: "Merged",
      targetLength: 130,
      theme: "ember",
      difficultyFrom: 0.3,
      difficultyTo: 0.7,
      sections: [
        { mode: "cube", weight: 1 },
        { mode: "ship", weight: 1 },
      ],
    });

    // Splitting every merged solid back into unit cells must leave the level
    // equally solvable, which is what makes the merge safe.
    const split = {
      ...level,
      objects: level.objects.flatMap((object) => {
        const width = object.width ?? 1;
        if (object.type !== "spanPlatform" && object.type !== "ceilingBlock") {
          return [object];
        }
        return Array.from({ length: Math.round(width) }, (_, i) => ({
          ...object,
          id: `${object.id}s${i}`,
          x: object.x + i,
          width: 1,
        }));
      }),
    };

    assert.equal(isSolvable(level), isSolvable(split));
  });

  it("generates endless stages that a replay can clear", () => {
    for (const stageIndex of [0, 3]) {
      const stage = createEndlessStage(20260821, stageIndex);
      const level = generateLevel(stage.options);
      const solved = solveLevel(level, { trackPath: true });

      assert.equal(solved.solvable, true, `stage ${stageIndex} was not solvable`);

      const engine = new GameEngine(level, new ReplayInput(solved.path!));
      let status = engine.getStatus();
      for (let tick = 0; tick < solved.path!.length + 10 && status === "running"; tick += 1) {
        status = engine.step().status;
      }
      assert.equal(status, "finished", `stage ${stageIndex} replay ended as ${status}`);
    }
  });

  it("gets harder as stages advance", () => {
    const early = createEndlessStage(1, 0);
    const late = createEndlessStage(1, 8);

    assert.ok(late.options.difficultyTo > early.options.difficultyTo);
    assert.ok((late.options.baseSpeed ?? 0) > (early.options.baseSpeed ?? 0));
    assert.notEqual(early.seed, late.seed);
  });
});

describe("random", () => {
  it("is reproducible and never degenerates on a zero seed", () => {
    const a = new Random(0);
    const b = new Random(0);
    const values = Array.from({ length: 200 }, () => a.next());

    assert.deepEqual(values, Array.from({ length: 200 }, () => b.next()));
    assert.equal(new Set(values).size > 190, true, "sequence collapsed to a fixed point");
    assert.ok(Math.min(...values) >= 0 && Math.max(...values) < 1);
  });

  it("respects weighted selection", () => {
    const rng = new Random(7);
    const counts = { a: 0, b: 0 };
    for (let i = 0; i < 4000; i += 1) {
      counts[rng.weighted([
        { value: "a" as const, weight: 3 },
        { value: "b" as const, weight: 1 },
      ])] += 1;
    }
    const ratio = counts.a / counts.b;
    assert.ok(ratio > 2.4 && ratio < 3.6, `ratio was ${ratio.toFixed(2)}`);
  });
});
