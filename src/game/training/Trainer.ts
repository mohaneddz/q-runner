import type { Observation } from "@/game/core/types";
import type { LevelData } from "@/game/level/levelSchema";
import { deserializeAgent, type RLAgent, type SerializedAgent } from "@/game/training/agent";
import { TrainingEnv } from "@/game/training/env";
import { QLearningAgent } from "@/game/training/qlearning";

export interface TrainerMetrics {
  episode: number;
  totalSteps: number;
  episodeReward: number;
  averageReward: number;
  bestProgress: number;
  averageProgress: number;
  completionRate: number;
  epsilon: number;
  stateCount: number;
  stepsPerSecond: number;
}

interface EpisodeRecord {
  reward: number;
  progress: number;
  completed: boolean;
}

const WINDOW = 100;
/** Steps between clock reads — checking every step dominates the loop. */
const TIME_CHECK_INTERVAL = 512;

export class Trainer<TAgent extends RLAgent = QLearningAgent> {
  private env: TrainingEnv;
  private agent: TAgent;
  private observation: Observation;
  private history: EpisodeRecord[] = [];
  private episode = 1;
  private episodeReward = 0;
  private totalSteps = 0;
  private bestProgress = 0;
  private stepsPerSecond = 0;

  // `agent` must match TAgent — the default only ever fires for the plain
  // `new Trainer(level)` call sites, which always want a QLearningAgent.
  constructor(
    private level: LevelData,
    agent?: TAgent,
  ) {
    this.env = new TrainingEnv(level);
    this.agent = agent ?? (new QLearningAgent() as TAgent);
    this.observation = this.env.reset();
  }

  getAgent(): TAgent {
    return this.agent;
  }

  setLevel(level: LevelData): void {
    this.level = level;
    this.env = new TrainingEnv(level);
    this.observation = this.env.reset();
    this.episodeReward = 0;
  }

  getLevel(): LevelData {
    return this.level;
  }

  /** Caller is responsible for passing data serialized from a matching algorithm. */
  loadAgent(data: SerializedAgent): void {
    this.agent = deserializeAgent(data) as TAgent;
    this.observation = this.env.reset();
  }

  reset(): void {
    this.agent.reset();
    this.history = [];
    this.episode = 1;
    this.episodeReward = 0;
    this.totalSteps = 0;
    this.bestProgress = 0;
    this.observation = this.env.reset();
  }

  /**
   * Runs as many steps as fit in the budget rather than a fixed count, so the
   * UI stays responsive on slow machines and fast ones still train quickly.
   */
  runFor(budgetMs: number): TrainerMetrics {
    const startedAt = performance.now();
    const deadline = startedAt + budgetMs;
    let steps = 0;

    for (;;) {
      const action = this.agent.getAction(this.observation);
      const transition = this.env.step(action);

      this.agent.update(
        this.observation,
        action,
        transition.reward,
        transition.observation,
        transition.done,
      );

      this.episodeReward += transition.reward;
      this.observation = transition.observation;
      this.totalSteps += 1;
      steps += 1;

      if (transition.done) {
        this.bestProgress = Math.max(this.bestProgress, transition.progress);
        this.history.push({
          reward: this.episodeReward,
          progress: transition.progress,
          completed: transition.status === "finished",
        });
        if (this.history.length > WINDOW) {
          this.history.shift();
        }
        this.episode += 1;
        this.episodeReward = 0;
        this.observation = this.env.reset();
      }

      if (steps % TIME_CHECK_INTERVAL === 0 && performance.now() >= deadline) {
        break;
      }
    }

    const elapsed = Math.max(1, performance.now() - startedAt);
    this.stepsPerSecond = (steps / elapsed) * 1000;

    return this.getMetrics();
  }

  getMetrics(): TrainerMetrics {
    const count = this.history.length;
    const sum = this.history.reduce(
      (totals, record) => {
        totals.reward += record.reward;
        totals.progress += record.progress;
        totals.completed += record.completed ? 1 : 0;
        return totals;
      },
      { reward: 0, progress: 0, completed: 0 },
    );

    return {
      episode: this.episode,
      totalSteps: this.totalSteps,
      episodeReward: this.episodeReward,
      averageReward: count === 0 ? 0 : sum.reward / count,
      bestProgress: this.bestProgress,
      averageProgress: count === 0 ? 0 : sum.progress / count,
      completionRate: count === 0 ? 0 : sum.completed / count,
      epsilon: this.agent.epsilon,
      stateCount: this.agent.stateCount,
      stepsPerSecond: this.stepsPerSecond,
    };
  }
}
