import type { Action, Observation } from "@/game/core/types";
import { encodeState } from "@/game/training/stateExtractor";

export interface QLearningConfig {
  alpha: number;
  gamma: number;
  epsilon: number;
  epsilonDecay: number;
  epsilonMin: number;
}

/**
 * Decay and floor are set against the throughput this actually runs at —
 * upwards of 150k steps a second. A per-step decay of 0.99994 collapsed
 * exploration inside the first two seconds; this one anneals over roughly a
 * million steps instead.
 *
 * The floor is deliberately low. One mistimed input is fatal here, so at a 2%
 * random-action rate even a perfect policy throws away most of a 1900-tick
 * level, and the clear rate never reflects what the agent has learned.
 */
export const DEFAULT_CONFIG: QLearningConfig = {
  alpha: 0.2,
  gamma: 0.97,
  epsilon: 1,
  epsilonDecay: 0.999996,
  epsilonMin: 0.002,
};

export interface SerializedQLearningAgent {
  algorithm: "qlearning";
  version: 1;
  config: QLearningConfig;
  steps: number;
  entries: [string, number, number][];
}

export class QLearningAgent {
  readonly algorithm = "qlearning" as const;
  private table = new Map<string, [number, number]>();
  private config: QLearningConfig;
  private steps = 0;

  constructor(config?: Partial<QLearningConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  get epsilon(): number {
    return this.config.epsilon;
  }

  get stateCount(): number {
    return this.table.size;
  }

  get stepCount(): number {
    return this.steps;
  }

  configure(config: Partial<QLearningConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): QLearningConfig {
    return { ...this.config };
  }

  reset(): void {
    this.table.clear();
    this.config = { ...this.config, epsilon: DEFAULT_CONFIG.epsilon };
    this.steps = 0;
  }

  private values(key: string): [number, number] {
    let entry = this.table.get(key);
    if (!entry) {
      entry = [0, 0];
      this.table.set(key, entry);
    }
    return entry;
  }

  /** Epsilon-greedy while training. */
  getAction(observation: Observation): Action {
    if (Math.random() < this.config.epsilon) {
      return Math.random() < 0.5 ? 0 : 1;
    }
    return this.getGreedyAction(observation);
  }

  /** What the agent has actually learned, with no exploration noise. */
  getGreedyAction(observation: Observation): Action {
    const entry = this.table.get(encodeState(observation));
    if (!entry) {
      return 0;
    }
    return entry[1] > entry[0] ? 1 : 0;
  }

  update(
    observation: Observation,
    action: Action,
    reward: number,
    nextObservation: Observation,
    done: boolean,
  ): void {
    const entry = this.values(encodeState(observation));
    const bestNext = done ? 0 : Math.max(...this.values(encodeState(nextObservation)));

    entry[action] += this.config.alpha * (reward + this.config.gamma * bestNext - entry[action]);

    this.steps += 1;
    this.config.epsilon = Math.max(
      this.config.epsilonMin,
      this.config.epsilon * this.config.epsilonDecay,
    );
  }

  serialize(): SerializedQLearningAgent {
    return {
      algorithm: "qlearning",
      version: 1,
      config: this.config,
      steps: this.steps,
      entries: [...this.table.entries()].map(([key, value]) => [key, value[0], value[1]]),
    };
  }

  static deserialize(data: SerializedQLearningAgent): QLearningAgent {
    const agent = new QLearningAgent(data.config);
    agent.steps = data.steps;
    for (const [key, zero, one] of data.entries) {
      agent.table.set(key, [zero, one]);
    }
    return agent;
  }
}
