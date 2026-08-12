import { TrainingEnv } from "@/game/training/env";
import { QLearningAgent } from "@/game/training/qlearning";
import type { Observation } from "@/game/core/types";
import type { LevelData } from "@/game/level/levelTypes";

export interface TrainerMetrics {
  episode: number;
  episodeReward: number;
  averageReward: number;
  epsilon: number;
}

export class Trainer {
  private readonly env: TrainingEnv;
  private readonly agent: QLearningAgent;
  private observation: Observation;
  private episode = 1;
  private episodeReward = 0;
  private history: number[] = [];

  constructor(level: LevelData) {
    this.env = new TrainingEnv(level);
    this.agent = new QLearningAgent();
    this.observation = this.env.reset();
  }

  reset(): void {
    this.agent.reset();
    this.episode = 1;
    this.episodeReward = 0;
    this.history = [];
    this.observation = this.env.reset();
  }

  stepMany(iterations: number): TrainerMetrics {
    for (let i = 0; i < iterations; i += 1) {
      const action = this.agent.getAction(this.observation);
      const transition = this.env.step(action);
      this.agent.update(this.observation, action, transition.reward, transition.observation, transition.done);
      this.episodeReward += transition.reward;
      this.observation = transition.observation;

      if (transition.done) {
        this.history.push(this.episodeReward);
        if (this.history.length > 100) {
          this.history.shift();
        }
        this.episode += 1;
        this.episodeReward = 0;
        this.observation = this.env.reset();
      }
    }

    const averageReward =
      this.history.length === 0
        ? 0
        : this.history.reduce((sum, item) => sum + item, 0) / this.history.length;

    return {
      episode: this.episode,
      episodeReward: this.episodeReward,
      averageReward,
      epsilon: this.agent.epsilon,
    };
  }
}
