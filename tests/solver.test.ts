import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { extractObservation, LOOKAHEAD } from "@/game/core/observation";
import { GameEngine } from "@/game/core/GameEngine";
import { AgentInput, createHeuristicPolicy } from "@/game/input/AgentInput";
import { parseLevel } from "@/game/level/levelSchema";
import { QLearningAgent } from "@/game/training/qlearning";
import { encodeState } from "@/game/training/stateExtractor";
import { Trainer } from "@/game/training/Trainer";
import { HUMAN_INPUT_GRANULARITY, solveLevel } from "@/game/validation/reachabilitySolver";
import { contextFor, ground, level, object, spawn } from "./helpers";

describe("reachability solver", () => {
  it("clears a flat runway", () => {
    const data = level([ground(80), object("finishGate", 60, 1, 1, 3)], { length: 70 });
    assert.equal(solveLevel(data).solvable, true);
  });

  it("rejects a level walled off by hazards", () => {
    const wall = Array.from({ length: 40 }, (_, i) => object("spikeTall", 20, 1 + i * 2));
    const data = level([ground(80), ...wall, object("finishGate", 60, 1, 1, 3)], { length: 70 });

    const result = solveLevel(data);
    assert.equal(result.solvable, false);
    assert.ok(result.reachedX < 22, `solver got to x=${result.reachedX}, past the wall`);
  });

  it("rejects a pit that is too wide to jump", () => {
    const data = level(
      [
        object("spanPlatform", 0, 0, 12, 1),
        object("spanPlatform", 40, 0, 40, 1),
        object("finishGate", 60, 1, 1, 3),
      ],
      { length: 70 },
    );
    assert.equal(solveLevel(data).solvable, false);
  });

  it("is monotone in input granularity", () => {
    // Anything clearable on the coarse 20Hz grid is clearable frame by frame.
    const file = path.resolve("src/data/builtinLevels/level09.json");
    const data = parseLevel(JSON.parse(fs.readFileSync(file, "utf8")));

    assert.equal(solveLevel(data, { inputGranularity: HUMAN_INPUT_GRANULARITY }).solvable, true);
    assert.equal(solveLevel(data, { inputGranularity: 1 }).solvable, true);
  });

  it("reports how far it got when it fails", () => {
    const data = level(
      [object("spanPlatform", 0, 0, 15, 1), object("finishGate", 60, 1, 1, 3)],
      { length: 70 },
    );
    const result = solveLevel(data);
    assert.equal(result.solvable, false);
    assert.ok(result.reachedX > 2, "no progress was reported at all");
    assert.ok(result.ticksSurvived > 0);
  });
});

describe("observation", () => {
  it("reports the distance to the next hazard", () => {
    const data = level([ground(80), object("spikeSingle", 12, 1)], { length: 70 });
    const context = contextFor(data);
    const state = spawn();

    const observation = extractObservation(state, context);
    assert.ok(Math.abs(observation.distanceToHazard - (12 - 2.8)) < 0.01);
    assert.equal(observation.hazardHeight, 1);
  });

  it("reads a clear track as clear", () => {
    const data = level([ground(200)], { length: 200 });
    const observation = extractObservation(spawn(), contextFor(data));

    assert.equal(observation.distanceToHazard, LOOKAHEAD);
    assert.equal(observation.hazardHeight, 0);
    assert.equal(observation.gapAhead, 0);
  });

  it("measures where a pit starts and how wide it is", () => {
    const data = level(
      [object("spanPlatform", 0, 0, 10, 1), object("spanPlatform", 14, 0, 40, 1)],
      { length: 60 },
    );
    const observation = extractObservation(spawn(), contextFor(data));

    // The player is supported while any part of its 0.8-wide box is over a
    // platform, so a 4-unit hole leaves ~3.2 units with nothing underneath;
    // the 0.25 sampling step reports that as 3.
    assert.ok(
      observation.gapAhead >= 2.9 && observation.gapAhead <= 3.6,
      `gap ${observation.gapAhead}`,
    );
    assert.ok(
      observation.distanceToGap > 7.5 && observation.distanceToGap < 9,
      `distance ${observation.distanceToGap}`,
    );
  });

  it("measures overhead clearance in a corridor", () => {
    const data = level([ground(80), object("ceilingBlock", 0, 6, 80, 1)], { length: 70 });
    const observation = extractObservation(spawn(), contextFor(data));
    assert.ok(Math.abs(observation.ceilingAbove - (6 - 1.8)) < 0.01);
  });

  it("reports velocity relative to the player's own down", () => {
    const data = level([ground(80)], { length: 70 });
    const context = contextFor(data);

    const normal = spawn("cube", 1);
    normal.vy = -5;
    assert.ok(extractObservation(normal, context).verticalVelocity < 0, "falling reads negative");

    const flipped = spawn("cube", -1);
    flipped.vy = 5;
    assert.ok(
      extractObservation(flipped, context).verticalVelocity < 0,
      "falling reads negative under flipped gravity too",
    );
  });
});

describe("agents", () => {
  it("keeps each mode in its own region of the state space", () => {
    const data = level([ground(80)], { length: 70 });
    const context = contextFor(data);

    const keys = (["cube", "ship", "ball"] as const).map((mode) =>
      encodeState(extractObservation(spawn(mode), context)),
    );

    assert.equal(new Set(keys).size, 3, "two modes collided on one state key");
  });

  it("round-trips a trained table", () => {
    const data = level([ground(200), object("spikeSingle", 20, 1)], { length: 120 });
    const trainer = new Trainer(data);
    trainer.runFor(60);

    const original = trainer.getAgent();
    assert.ok(original.stateCount > 0, "training visited no states");

    const restored = QLearningAgent.deserialize(original.serialize());
    assert.equal(restored.stateCount, original.stateCount);
    assert.equal(restored.epsilon, original.epsilon);

    const observation = extractObservation(spawn(), contextFor(data));
    assert.equal(restored.getGreedyAction(observation), original.getGreedyAction(observation));
  });

  it("makes measurable progress while training", () => {
    const data = level(
      [ground(200), object("spikeSingle", 24, 1), object("finishGate", 100, 1, 1, 3)],
      { length: 110 },
    );
    const trainer = new Trainer(data);
    const metrics = trainer.runFor(400);

    assert.ok(metrics.totalSteps > 1000, `only ${metrics.totalSteps} steps in 400ms`);
    assert.ok(metrics.episode > 1, "no episode ever ended");
    assert.ok(metrics.stateCount > 0);
    assert.ok(metrics.epsilon < 1, "epsilon never decayed");
  });

  it("gets the heuristic past a simple spike", () => {
    const data = level(
      [ground(200), object("spikeSingle", 20, 1), object("finishGate", 60, 1, 1, 3)],
      { length: 70 },
    );
    const engine = new GameEngine(data, new AgentInput(createHeuristicPolicy()));

    let status = engine.getStatus();
    for (let tick = 0; tick < 5000 && status === "running"; tick += 1) {
      status = engine.step().status;
    }

    assert.equal(status, "finished", "the baseline policy could not clear one spike");
  });
});
