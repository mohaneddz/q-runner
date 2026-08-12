import { GameEngine } from "@/game/core/GameEngine";
import { AgentInput } from "@/game/input/AgentInput";
import type { LevelData } from "@/game/level/levelTypes";
import type { Action, Observation } from "@/game/core/types";

export interface EnvStep {
  observation: Observation;
  reward: number;
  done: boolean;
}

export class TrainingEnv {
  private readonly engine: GameEngine;

  constructor(level: LevelData) {
    this.engine = new GameEngine(level, new AgentInput(() => 0));
  }

  reset(): Observation {
    this.engine.reset();
    return this.engine.getObservation();
  }

  step(action: Action): EnvStep {
    const result = this.engine.step(action);
    return {
      observation: result.observation,
      reward: result.reward,
      done: result.done,
    };
  }
}
