import type { LevelData, LevelObject } from "@/game/level/levelTypes";

export type Action = 0 | 1;

export interface Observation {
  distanceToNextObstacle: number;
  obstacleHeight: number;
  verticalVelocity: number;
  grounded: 0 | 1;
}

export interface InputProvider {
  getAction(state: Observation): Action;
}

export interface PlayerState {
  x: number;
  y: number;
  width: number;
  height: number;
  vx: number;
  vy: number;
  grounded: boolean;
  rotation: number;
}

export interface Snapshot {
  player: PlayerState;
  level: LevelData;
  cameraX: number;
  status: "running" | "dead" | "finished";
  reward: number;
  totalReward: number;
  progress: number;
  tick: number;
  observation: Observation;
  objects: LevelObject[];
}

export interface StepResult {
  reward: number;
  done: boolean;
  passedObstacle: boolean;
  status: "running" | "dead" | "finished";
  observation: Observation;
}
