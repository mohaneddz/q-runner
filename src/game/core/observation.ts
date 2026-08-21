import { PLAYER_SIZE } from "@/game/core/constants";
import type { SimState } from "@/game/core/simulation";
import type { Observation } from "@/game/core/types";
import type { LevelContext, ResolvedObject } from "@/game/level/levelGeometry";

/** How far ahead the agent can "see". Beyond this, everything reads as clear. */
export const LOOKAHEAD = 12;
const SAMPLE_STEP = 0.25;
/** Vertical band a surface must sit in to count as somewhere the player lands. */
const SUPPORT_BELOW = 9;
const SUPPORT_ABOVE = 0.6;
const CEILING_LIMIT = 10;

/** Height of the surface the player would land on at `x`, in world units. */
function supportAt(state: SimState, context: LevelContext, x: number): number | null {
  const candidates = context.index.near(x, PLAYER_SIZE);
  let best: number | null = null;

  for (const object of candidates) {
    if (object.category !== "solid" || x + PLAYER_SIZE < object.x || x > object.right) {
      continue;
    }

    const surface = state.gravity === 1 ? object.top : object.y;
    const delta = (surface - state.y) * state.gravity;
    if (delta > SUPPORT_ABOVE || delta < -SUPPORT_BELOW) {
      continue;
    }
    if (best === null || (surface - best) * state.gravity > 0) {
      best = surface;
    }
  }

  return best;
}

/** Clearance overhead, which is what ship and ball sections are steered by. */
function ceilingClearance(state: SimState, context: LevelContext): number {
  let best = CEILING_LIMIT;
  for (const object of context.index.near(state.x, PLAYER_SIZE)) {
    if (object.category !== "solid") {
      continue;
    }
    const surface = state.gravity === 1 ? object.y : object.top;
    const delta = (surface - (state.y + PLAYER_SIZE)) * state.gravity;
    if (delta >= 0 && delta < best) {
      best = delta;
    }
  }
  return best;
}

function nextHazard(state: SimState, context: LevelContext): ResolvedObject | null {
  let best: ResolvedObject | null = null;
  for (const object of context.index.near(state.x, LOOKAHEAD)) {
    if (object.category !== "hazard" || object.right < state.x || object.x > state.x + LOOKAHEAD) {
      continue;
    }
    if (!best || object.x < best.x) {
      best = object;
    }
  }
  return best;
}

export function extractObservation(state: SimState, context: LevelContext): Observation {
  const hazard = nextHazard(state, context);

  let distanceToGap = LOOKAHEAD;
  let gapAhead = 0;
  let surfaceDelta = 0;
  let inGap = false;

  for (let offset = 0; offset <= LOOKAHEAD; offset += SAMPLE_STEP) {
    const support = supportAt(state, context, state.x + offset);

    if (support === null) {
      if (!inGap) {
        inGap = true;
        distanceToGap = offset;
      }
      gapAhead += SAMPLE_STEP;
      continue;
    }

    surfaceDelta = (support - state.y) * state.gravity;
    if (inGap) {
      break;
    }
  }

  return {
    distanceToHazard: hazard ? Math.max(0, hazard.x - (state.x + PLAYER_SIZE)) : LOOKAHEAD,
    hazardHeight: hazard ? hazard.height : 0,
    distanceToGap,
    gapAhead: Math.min(gapAhead, LOOKAHEAD),
    surfaceDelta,
    ceilingAbove: ceilingClearance(state, context),
    verticalVelocity: state.vy * state.gravity,
    grounded: state.grounded ? 1 : 0,
    mode: state.mode,
    gravity: state.gravity,
  };
}
