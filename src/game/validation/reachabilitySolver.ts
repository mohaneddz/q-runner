import {
  FIXED_DT,
  PLAYER_START_X,
  PLAYER_START_Y,
  PLAYER_START_Y_FLIPPED,
} from "@/game/core/constants";
import { cloneSimState, createSimState, stepSimulation, type SimState } from "@/game/core/simulation";
import { createLevelContext, type LevelContext } from "@/game/level/levelGeometry";
import type { LevelData } from "@/game/level/levelSchema";

export interface SolverOptions {
  /** Distinct surviving states carried between ticks. */
  beamWidth?: number;
  /** Record the winning input sequence. Costs memory; off by default. */
  trackPath?: boolean;
  /**
   * Ticks between allowed input changes. At the 120Hz tick rate the default of
   * 6 means the solver may only act on a 20Hz grid — so a level that passes is
   * clearable with roughly 50ms of timing slack rather than frame-perfectly.
   */
  inputGranularity?: number;
}

/** 50ms of input slack: what a person can actually hit. */
export const HUMAN_INPUT_GRANULARITY = 6;

export interface SolverResult {
  solvable: boolean;
  /** Ticks the search survived — where the level becomes impossible. */
  ticksSurvived: number;
  /** World x the search reached before dying out. */
  reachedX: number;
  /** Per-tick hold inputs that clear the level, when `trackPath` is set. */
  path?: boolean[];
}

const DEFAULT_BEAM_WIDTH = 900;

interface Node {
  state: SimState;
  parent: Node | null;
  hold: boolean;
}

/**
 * Every candidate at a given tick shares the same x — horizontal speed is
 * constant and input-independent — so the search only has to spread over
 * vertical state. Quantising that gives an exact-enough dedup key.
 */
function keyFor(state: SimState): string {
  return [
    Math.round(state.y * 16),
    Math.round(state.vy * 8),
    state.mode,
    state.gravity,
    state.grounded ? 1 : 0,
    state.held ? 1 : 0,
  ].join("|");
}

function startState(level: LevelData): SimState {
  const { startMode, startGravity } = level.settings;
  return createSimState(
    startMode,
    startGravity,
    PLAYER_START_X,
    startGravity === 1 ? PLAYER_START_Y : PLAYER_START_Y_FLIPPED,
  );
}

/**
 * Keeps the beam diverse instead of truncating it. Candidates are already
 * sorted by height, so an even stride preserves both the highest and lowest
 * survivable trajectories rather than dropping one whole extreme.
 */
function thin(nodes: Node[], limit: number): Node[] {
  if (nodes.length <= limit) {
    return nodes;
  }
  const stride = nodes.length / limit;
  const result: Node[] = [];
  for (let i = 0; i < limit; i += 1) {
    result.push(nodes[Math.floor(i * stride)]);
  }
  return result;
}

function reconstruct(node: Node): boolean[] {
  const path: boolean[] = [];
  let cursor: Node | null = node;
  while (cursor && cursor.parent) {
    path.push(cursor.hold);
    cursor = cursor.parent;
  }
  return path.reverse();
}

export function solveLevel(level: LevelData, options: SolverOptions = {}): SolverResult {
  const context: LevelContext = createLevelContext(level);
  const beamWidth = options.beamWidth ?? DEFAULT_BEAM_WIDTH;
  const maxTicks = Math.ceil((level.settings.length / level.settings.baseSpeed) / FIXED_DT) + 240;

  let frontier: Node[] = [{ state: startState(level), parent: null, hold: false }];
  let reachedX = frontier[0].state.x;

  const granularity = Math.max(1, options.inputGranularity ?? HUMAN_INPUT_GRANULARITY);

  for (let tick = 0; tick < maxTicks; tick += 1) {
    const seen = new Map<string, Node>();
    const canChangeInput = tick % granularity === 0;

    for (const node of frontier) {
      const holds = canChangeInput ? [false, true] : [node.state.held];
      for (const hold of holds) {
        const next = cloneSimState(node.state);
        const outcome = stepSimulation(next, hold, context);

        if (outcome.finished) {
          return {
            solvable: true,
            ticksSurvived: tick + 1,
            reachedX: next.x,
            path: options.trackPath ? reconstruct({ state: next, parent: node, hold }) : undefined,
          };
        }
        if (outcome.dead) {
          continue;
        }

        const key = keyFor(next);
        if (!seen.has(key)) {
          seen.set(key, { state: next, parent: options.trackPath ? node : null, hold });
        }
      }
    }

    if (seen.size === 0) {
      return { solvable: false, ticksSurvived: tick, reachedX };
    }

    const candidates = [...seen.values()].sort((a, b) => a.state.y - b.state.y);
    frontier = thin(candidates, beamWidth);
    reachedX = frontier[0].state.x;
  }

  return { solvable: false, ticksSurvived: maxTicks, reachedX };
}

export function isSolvable(level: LevelData, options?: SolverOptions): boolean {
  return solveLevel(level, options).solvable;
}
