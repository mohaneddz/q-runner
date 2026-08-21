import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CUBE_JUMP_VELOCITY,
  FIXED_DT,
  GRAVITY_ACCEL,
  MAX_FALL_SPEED,
  PLAYER_SIZE,
} from "@/game/core/constants";
import { cloneSimState, stepSimulation } from "@/game/core/simulation";
import { contextFor, ground, level, object, spawn } from "./helpers";

/** Runs `ticks` steps, holding on the ticks listed in `holdAt`. */
function run(
  data: ReturnType<typeof level>,
  ticks: number,
  holdAt: (tick: number, state: ReturnType<typeof spawn>) => boolean = () => false,
) {
  const context = contextFor(data);
  const state = spawn(data.settings.startMode, data.settings.startGravity);
  for (let tick = 0; tick < ticks; tick += 1) {
    const outcome = stepSimulation(state, holdAt(tick, state), context);
    if (outcome.dead || outcome.finished) {
      return { state, tick, ...outcome };
    }
  }
  return { state, tick: ticks, dead: false, finished: false, events: null };
}

describe("simulation", () => {
  it("settles onto the floor and stays grounded", () => {
    const result = run(level([ground(200)], { length: 1000 }), 240);
    assert.equal(result.dead, false);
    assert.equal(result.state.grounded, true);
    assert.equal(result.state.y, 1, "player rests exactly on the surface");
  });

  it("advances horizontally at exactly the level's base speed", () => {
    const data = level([ground(400)], { length: 1000, baseSpeed: 8 });
    const result = run(data, 120);
    const expected = 2 + 8 * 120 * FIXED_DT;
    assert.ok(Math.abs(result.state.x - expected) < 1e-9, `x was ${result.state.x}`);
  });

  it("reaches the documented jump height and no higher", () => {
    const data = level([ground(400)], { length: 1000 });
    const context = contextFor(data);
    const state = spawn();

    // Settle first so the jump starts from a grounded state.
    for (let i = 0; i < 10; i += 1) {
      stepSimulation(state, false, context);
    }

    let peak = state.y;
    stepSimulation(state, true, context);
    for (let i = 0; i < 200; i += 1) {
      stepSimulation(state, false, context);
      peak = Math.max(peak, state.y);
      if (state.grounded) {
        break;
      }
    }

    const theoretical = 1 + (CUBE_JUMP_VELOCITY * CUBE_JUMP_VELOCITY) / (2 * GRAVITY_ACCEL);
    assert.ok(
      Math.abs(peak - theoretical) < 0.05,
      `peak ${peak.toFixed(3)} vs theoretical ${theoretical.toFixed(3)}`,
    );
  });

  it("kills on a spike and survives when the spike is jumped", () => {
    const data = level([ground(400), object("spikeSingle", 12, 1)], { length: 1000 });

    const walked = run(data, 400);
    assert.equal(walked.dead, true, "walking into a spike is fatal");

    // The arc clears a spike at x=12 for take-offs between about x=6.8 and
    // x=10.8; jumping earlier lands the descent straight onto it.
    const jumped = run(data, 400, (_tick, state) => state.grounded && state.x > 8 && state.x < 8.2);
    assert.equal(jumped.dead, false, "a timed jump clears it");
  });

  it("leaves a jump window wide enough to hit by hand", () => {
    const data = level([ground(400), object("spikeSingle", 12, 1)], { length: 1000 });

    const clears = (takeOff: number) =>
      !run(data, 400, (_tick, state) => state.grounded && state.x > takeOff && state.x < takeOff + 0.1)
        .dead;

    const window = [];
    for (let x = 5; x < 12; x += 0.1) {
      if (clears(x)) {
        window.push(x);
      }
    }

    assert.ok(
      window.length > 0 && window[window.length - 1] - window[0] > 2,
      `take-off window was only ${(window[window.length - 1] - window[0]).toFixed(2)} units`,
    );
  });

  it("treats a step up as a wall", () => {
    const data = level([ground(400), object("connectedPlatformBlock", 12, 1, 2, 2)], {
      length: 1000,
    });
    const result = run(data, 400);
    assert.equal(result.dead, true, "running into a raised block is fatal");
  });

  it("does not tunnel through the floor at terminal velocity", () => {
    const data = level([ground(400)], { length: 1000 });
    const context = contextFor(data);
    const state = spawn();
    state.y = 30;
    state.vy = -MAX_FALL_SPEED;

    for (let i = 0; i < 600; i += 1) {
      const outcome = stepSimulation(state, false, context);
      assert.equal(outcome.dead, false, `died on tick ${i} at y=${state.y}`);
      if (state.grounded) {
        break;
      }
    }
    assert.equal(state.grounded, true);
    assert.equal(state.y, 1);
  });

  it("falls out of the world through a pit", () => {
    const data = level(
      [object("spanPlatform", 0, 0, 10, 1), object("spanPlatform", 40, 0, 40, 1)],
      { length: 1000 },
    );
    const result = run(data, 1200);
    assert.equal(result.dead, true);
  });

  it("fires an orb on a fresh press but not while held", () => {
    const data = level([ground(400), object("yellowOrb", 12, 2)], { length: 1000 });
    const context = contextFor(data);

    const held = spawn();
    let heldFired = false;
    for (let i = 0; i < 400; i += 1) {
      // Holding from tick zero: the cube jumps repeatedly, and the orb must
      // not re-trigger every tick it is touched.
      const outcome = stepSimulation(held, true, context);
      if (outcome.events.orbHit) {
        assert.equal(heldFired, false, "orb fired more than once while held");
        heldFired = true;
      }
      if (outcome.dead || outcome.finished) {
        break;
      }
    }
  });

  it("launches off a pad without any input", () => {
    const data = level([ground(400), object("yellowPad", 12, 1)], { length: 1000 });
    const context = contextFor(data);
    const state = spawn();

    let launched = false;
    for (let i = 0; i < 400; i += 1) {
      const outcome = stepSimulation(state, false, context);
      if (outcome.events.padHit) {
        launched = true;
        assert.ok(state.vy > 0, "pad sends the player upward");
        break;
      }
    }
    assert.equal(launched, true, "the pad was never reached");
  });

  it("switches mode and gravity through portals", () => {
    const data = level(
      [ground(400), object("shipPortal", 12, 1, 1, 4), object("gravityUpPortal", 20, 1, 1, 6)],
      { length: 1000 },
    );
    const context = contextFor(data);
    const state = spawn();

    let sawShip = false;
    for (let i = 0; i < 400; i += 1) {
      stepSimulation(state, false, context);
      if (state.mode === "ship") {
        sawShip = true;
      }
      if (state.gravity === -1) {
        break;
      }
    }

    assert.equal(sawShip, true, "ship portal did not change mode");
    assert.equal(state.gravity, -1, "gravity portal did not flip gravity");
  });

  it("is deterministic for identical inputs", () => {
    const data = level([ground(400), object("spikeSingle", 20, 1)], { length: 1000 });
    const inputs = Array.from({ length: 500 }, (_, i) => i % 37 === 0);

    const play = () => {
      const context = contextFor(data);
      const state = spawn();
      const trace: string[] = [];
      for (const hold of inputs) {
        const outcome = stepSimulation(state, hold, context);
        trace.push(`${state.x.toFixed(6)}:${state.y.toFixed(6)}:${state.vy.toFixed(6)}`);
        if (outcome.dead || outcome.finished) {
          break;
        }
      }
      return trace;
    };

    assert.deepEqual(play(), play());
  });

  it("keeps the player inside its own footprint when resting", () => {
    const data = level([ground(400)], { length: 1000 });
    const context = contextFor(data);
    const state = spawn();
    for (let i = 0; i < 300; i += 1) {
      stepSimulation(state, false, context);
    }
    assert.equal(state.y, 1);
    assert.equal(state.y + PLAYER_SIZE, 1 + PLAYER_SIZE);
  });

  it("clones without sharing state", () => {
    const state = spawn();
    const copy = cloneSimState(state);
    copy.x = 999;
    assert.notEqual(state.x, copy.x);
  });
});
