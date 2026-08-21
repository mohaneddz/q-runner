/**
 * All gameplay values are expressed in world units, not pixels. One unit is one
 * grid cell — the same unit the level JSON and the reachability solver use, so
 * the editor, the renderer, the engine and the build-time validator never have
 * to agree on a conversion factor.
 */

export const TICK_RATE = 120;
export const FIXED_DT = 1 / TICK_RATE;

export const PLAYER_SIZE = 0.8;
export const PLAYER_START_X = 2;
/** Spawn height with normal gravity; flipped levels start near the ceiling. */
export const PLAYER_START_Y = 1;
export const PLAYER_START_Y_FLIPPED = 6;

export const GRAVITY_ACCEL = 28;
export const MAX_FALL_SPEED = 32;

export const CUBE_JUMP_VELOCITY = 11.5;
export const SHIP_LIFT = 45;
export const SHIP_DAMPING = 0.965;
export const BALL_FLIP_VELOCITY = 2.5;

export const YELLOW_PAD_VELOCITY = 12.5;
export const PINK_PAD_VELOCITY = 14.5;
export const YELLOW_ORB_VELOCITY = 12;
export const PINK_ORB_VELOCITY = 15;

/** Falling or flying past these kills the run, matching the solver's bounds. */
export const WORLD_BOTTOM = -20;
export const WORLD_TOP = 40;

/** Crossing this close to the level end counts as a completion. */
export const FINISH_MARGIN = 1;

/** Landing tolerance — how far the player may already be inside a surface. */
export const SURFACE_EPSILON = 0.02;

/**
 * Hazards kill on a hitbox smaller than the drawn spike, so clipping a corner
 * of the triangle is survivable. Without this, full-AABB spikes make every
 * jump frame-perfect.
 */
export const HAZARD_HITBOX_SCALE = 0.55;

/**
 * Chosen against the cube arc: a jump clears 2.36 units of height over 6.6
 * units of ground, which keeps spike spacing and platform gaps readable.
 */
export const DEFAULT_BASE_SPEED = 8;

export const CANVAS_WIDTH = 1280;
export const CANVAS_HEIGHT = 720;
/**
 * Horizontal units visible at once; everything else derives from this. At 16:9
 * this leaves about 11 units of height, which frames a 7-unit-tall corridor
 * without burying the action under empty sky.
 */
export const UNITS_PER_SCREEN = 20;
/** Fraction of the viewport the player sits at, so obstacles are readable. */
export const CAMERA_ANCHOR = 0.32;
/** World y drawn at the bottom edge of the viewport. */
export const CAMERA_FLOOR = -1.2;

export const SURVIVE_REWARD = 0.01;
export const PROGRESS_REWARD = 1;
export const DEATH_REWARD = -10;
export const FINISH_REWARD = 20;
