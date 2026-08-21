import { CUBE_JUMP_VELOCITY, DEFAULT_BASE_SPEED, GRAVITY_ACCEL } from "@/game/core/constants";
import type { Action, InputProvider, Observation } from "@/game/core/types";

export type PolicyFn = (observation: Observation) => Action;

export class AgentInput implements InputProvider {
  constructor(private policy: PolicyFn) {}

  setPolicy(policy: PolicyFn): void {
    this.policy = policy;
  }

  getAction(observation: Observation): Action {
    return this.policy(observation);
  }
}

/** Horizontal reach of a cube jump from flat ground, used to time take-off. */
const JUMP_REACH = ((2 * CUBE_JUMP_VELOCITY) / GRAVITY_ACCEL) * DEFAULT_BASE_SPEED;

/**
 * A hand-written baseline. It is not meant to clear the late levels — it is
 * the reference the trained agent is measured against, and the "watch it play"
 * default before any training has happened.
 */
export function createHeuristicPolicy(): PolicyFn {
  return (observation) => {
    if (observation.mode === "ship") {
      // Hold to climb whenever the floor is closer than the ceiling.
      const floorGap = -observation.surfaceDelta;
      return floorGap < observation.ceilingAbove ? 1 : 0;
    }

    if (observation.mode === "ball") {
      if (!observation.grounded) {
        return 0;
      }
      return observation.distanceToHazard < 2.5 ? 1 : 0;
    }

    if (!observation.grounded) {
      return 0;
    }

    const hazardClose = observation.distanceToHazard < JUMP_REACH * 0.32;
    const gapClose = observation.gapAhead > 0 && observation.distanceToGap < JUMP_REACH * 0.14;
    return hazardClose || gapClose ? 1 : 0;
  };
}

/** Replays a fixed input sequence — used to play back a solver solution. */
export class ReplayInput implements InputProvider {
  private cursor = 0;

  constructor(private readonly path: readonly boolean[]) {}

  reset(): void {
    this.cursor = 0;
  }

  getAction(): Action {
    const hold = this.path[this.cursor] ?? false;
    this.cursor += 1;
    return hold ? 1 : 0;
  }
}
