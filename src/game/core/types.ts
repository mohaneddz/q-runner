import type { SimEvents, SimState } from "@/game/core/simulation";
import type { ResolvedObject } from "@/game/level/levelGeometry";
import type { LevelData } from "@/game/level/levelSchema";
import type { GameMode, Gravity } from "@/game/level/objectCatalog";

export type Action = 0 | 1;

export type RunStatus = "running" | "dead" | "finished";

export interface Observation {
  /** Units from the player's leading edge to the next hazard ahead. */
  distanceToHazard: number;
  hazardHeight: number;
  /** Units until the floor runs out. */
  distanceToGap: number;
  /** Width of that gap once it starts. */
  gapAhead: number;
  /** Height of the surface the player would land on, relative to them. */
  surfaceDelta: number;
  /** Clearance overhead — what ship and ball sections are steered by. */
  ceilingAbove: number;
  /** Signed so that positive always means "away from the ground". */
  verticalVelocity: number;
  grounded: 0 | 1;
  mode: GameMode;
  gravity: Gravity;
}

export interface InputProvider {
  getAction(observation: Observation): Action;
  /**
   * Called whenever a run starts. Providers that hold a position in a fixed
   * sequence must rewind here, or the second attempt replays from wherever the
   * first one stopped.
   */
  reset?(): void;
}

export interface Snapshot {
  player: SimState;
  level: LevelData;
  objects: ResolvedObject[];
  cameraX: number;
  status: RunStatus;
  progress: number;
  tick: number;
  attempt: number;
  totalReward: number;
  observation: Observation;
  events: SimEvents;
}

export interface StepResult {
  reward: number;
  done: boolean;
  status: RunStatus;
  observation: Observation;
  events: SimEvents;
}
