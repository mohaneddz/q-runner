import type { Action, Observation } from "@/game/core/types";

export interface QLearningConfig {
  alpha: number;
  gamma: number;
  epsilon: number;
  epsilonDecay: number;
  epsilonMin: number;
}

const DEFAULT_CONFIG: QLearningConfig = {
  alpha: 0.15,
  gamma: 0.95,
  epsilon: 1,
  epsilonDecay: 0.9995,
  epsilonMin: 0.05,
};

export class QLearningAgent {
  private qTable = new Map<string, [number, number]>();
  private config: QLearningConfig;

  constructor(config?: Partial<QLearningConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  get epsilon(): number {
    return this.config.epsilon;
  }

  reset(): void {
    this.qTable.clear();
    this.config.epsilon = 1;
  }

  getAction(observation: Observation): Action {
    if (Math.random() < this.config.epsilon) {
      return Math.random() < 0.5 ? 0 : 1;
    }

    const q = this.getQValues(this.keyFor(observation));
    return q[1] > q[0] ? 1 : 0;
  }

  update(state: Observation, action: Action, reward: number, nextState: Observation, done: boolean): void {
    const stateKey = this.keyFor(state);
    const nextKey = this.keyFor(nextState);

    const q = this.getQValues(stateKey);
    const nextQ = this.getQValues(nextKey);
    const bestNext = done ? 0 : Math.max(nextQ[0], nextQ[1]);

    q[action] = q[action] + this.config.alpha * (reward + this.config.gamma * bestNext - q[action]);
    this.qTable.set(stateKey, q);

    this.config.epsilon = Math.max(this.config.epsilonMin, this.config.epsilon * this.config.epsilonDecay);
  }

  private getQValues(key: string): [number, number] {
    const value = this.qTable.get(key);
    if (value) {
      return [...value] as [number, number];
    }
    return [0, 0];
  }

  private keyFor(observation: Observation): string {
    const dist = Math.min(20, Math.floor(observation.distanceToNextObstacle / 30));
    const vel = Math.max(-6, Math.min(6, Math.floor(observation.verticalVelocity / 120)));
    const h = Math.min(5, Math.floor(observation.obstacleHeight / 16));
    return `${dist}|${vel}|${h}|${observation.grounded}`;
  }
}
