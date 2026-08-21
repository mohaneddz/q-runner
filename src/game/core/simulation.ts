import {
  BALL_FLIP_VELOCITY,
  CUBE_JUMP_VELOCITY,
  FINISH_MARGIN,
  FIXED_DT,
  GRAVITY_ACCEL,
  HAZARD_HITBOX_SCALE,
  MAX_FALL_SPEED,
  PLAYER_SIZE,
  SHIP_DAMPING,
  SHIP_LIFT,
  SURFACE_EPSILON,
  WORLD_BOTTOM,
  WORLD_TOP,
} from "@/game/core/constants";
import { overlapsBox, type LevelContext, type ResolvedObject } from "@/game/level/levelGeometry";
import { definitionFor, type GameMode, type Gravity } from "@/game/level/objectCatalog";

export interface SimState {
  x: number;
  y: number;
  vy: number;
  gravity: Gravity;
  mode: GameMode;
  grounded: boolean;
  /** Previous tick's input, so orbs fire on a fresh tap rather than a hold. */
  held: boolean;
}

export interface SimEvents {
  jumped: boolean;
  landed: boolean;
  padHit: boolean;
  orbHit: boolean;
  portalHit: boolean;
}

export interface SimStepResult {
  dead: boolean;
  finished: boolean;
  events: SimEvents;
}

export function createSimState(mode: GameMode, gravity: Gravity, x: number, y: number): SimState {
  return { x, y, vy: 0, gravity, mode, grounded: false, held: false };
}

export function cloneSimState(state: SimState): SimState {
  return {
    x: state.x,
    y: state.y,
    vy: state.vy,
    gravity: state.gravity,
    mode: state.mode,
    grounded: state.grounded,
    held: state.held,
  };
}

function hazardBox(object: ResolvedObject) {
  const insetX = (object.width * (1 - HAZARD_HITBOX_SCALE)) / 2;
  const insetY = (object.height * (1 - HAZARD_HITBOX_SCALE)) / 2;
  return {
    x: object.x + insetX,
    y: object.y + insetY,
    right: object.right - insetX,
    top: object.top - insetY,
  };
}

/**
 * Advances one fixed tick in place. This is the only place the rules live —
 * `GameEngine`, the training environment and the reachability solver all call
 * it, so a level that the build gate proves solvable is solvable in the game.
 */
export function stepSimulation(
  state: SimState,
  hold: boolean,
  context: LevelContext,
): SimStepResult {
  const events: SimEvents = {
    jumped: false,
    landed: false,
    padHit: false,
    orbHit: false,
    portalHit: false,
  };
  const freshPress = hold && !state.held;
  state.held = hold;

  if (state.mode === "cube") {
    if (hold && state.grounded) {
      state.vy = CUBE_JUMP_VELOCITY * state.gravity;
      state.grounded = false;
      events.jumped = true;
    }
  } else if (state.mode === "ship") {
    const lift = hold ? SHIP_LIFT : 0;
    state.vy = (state.vy + lift * state.gravity * FIXED_DT) * SHIP_DAMPING;
  } else if (hold && state.grounded) {
    state.gravity = (state.gravity * -1) as Gravity;
    state.vy = BALL_FLIP_VELOCITY * state.gravity;
    state.grounded = false;
    events.jumped = true;
  }

  state.vy = Math.max(
    -MAX_FALL_SPEED,
    Math.min(MAX_FALL_SPEED, state.vy - GRAVITY_ACCEL * state.gravity * FIXED_DT),
  );

  const previousY = state.y;
  state.x += context.baseSpeed * FIXED_DT;
  state.y += state.vy * FIXED_DT;
  state.grounded = false;

  const nearby = context.index.near(state.x, PLAYER_SIZE);

  for (const object of nearby) {
    if (object.category !== "solid") {
      continue;
    }
    if (!overlapsBox(state.x, state.y, PLAYER_SIZE, PLAYER_SIZE, object)) {
      continue;
    }

    const cameFromAbove = previousY >= object.top - SURFACE_EPSILON;
    const cameFromBelow = previousY + PLAYER_SIZE <= object.y + SURFACE_EPSILON;

    if (cameFromAbove && state.vy < 0) {
      state.y = object.top;
      state.vy = 0;
      if (state.gravity === 1) {
        state.grounded = true;
        events.landed = true;
      }
    } else if (cameFromBelow && state.vy > 0) {
      state.y = object.y - PLAYER_SIZE;
      state.vy = 0;
      if (state.gravity === -1) {
        state.grounded = true;
        events.landed = true;
      }
    }
  }

  let dead = state.y < WORLD_BOTTOM || state.y > WORLD_TOP;
  let finished = state.x >= context.length - FINISH_MARGIN;

  for (const object of nearby) {
    if (object.category === "solid") {
      // Anything still intersecting after the vertical pass was hit side-on.
      if (overlapsBox(state.x, state.y, PLAYER_SIZE, PLAYER_SIZE, object)) {
        dead = true;
      }
      continue;
    }

    if (object.category === "hazard") {
      if (overlapsBox(state.x, state.y, PLAYER_SIZE, PLAYER_SIZE, hazardBox(object))) {
        dead = true;
      }
      continue;
    }

    if (!overlapsBox(state.x, state.y, PLAYER_SIZE, PLAYER_SIZE, object)) {
      continue;
    }

    if (object.category === "goal") {
      finished = true;
      continue;
    }

    const definition = definitionFor(object.type);

    if (object.category === "pad" && definition.padVelocity !== undefined) {
      state.vy = definition.padVelocity * state.gravity;
      state.grounded = false;
      events.padHit = true;
      continue;
    }

    if (object.category === "orb" && definition.orbVelocity !== undefined) {
      if (freshPress) {
        state.vy = definition.orbVelocity * state.gravity;
        state.grounded = false;
        events.orbHit = true;
      }
      continue;
    }

    if (object.category === "portal") {
      if (definition.portalMode && definition.portalMode !== state.mode) {
        state.mode = definition.portalMode;
        events.portalHit = true;
      }
      if (definition.portalGravity && definition.portalGravity !== state.gravity) {
        state.gravity = definition.portalGravity;
        state.grounded = false;
        events.portalHit = true;
      }
    }
  }

  return { dead: dead && !finished, finished, events };
}
