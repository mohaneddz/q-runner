import { GameEngine } from "@/game/core/GameEngine";
import type { Action, Observation, RunStatus } from "@/game/core/types";
import { AgentInput } from "@/game/input/AgentInput";
import type { LevelData } from "@/game/level/levelSchema";

export interface EnvStep {
  observation: Observation;
  reward: number;
  done: boolean;
  status: RunStatus;
  progress: number;
  ticks: number;
}

/** Thin adapter so the trainer never has to know about the engine's plumbing. */
export class TrainingEnv {
  private readonly engine: GameEngine;

  constructor(level: LevelData) {
    this.engine = new GameEngine(level, new AgentInput(() => 0));
  }

  reset(): Observation {
    this.engine.reset(false);
    return this.engine.getObservation();
  }

  step(action: Action): EnvStep {
    const result = this.engine.step(action);
    const snapshot = this.engine.getSnapshot();
    return {
      observation: result.observation,
      reward: result.reward,
      done: result.done,
      status: result.status,
      progress: snapshot.progress,
      ticks: snapshot.tick,
    };
  }
}
