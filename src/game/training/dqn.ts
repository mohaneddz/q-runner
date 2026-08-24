import type { Action, Observation } from "@/game/core/types";
import { MLP, type MLPWeights } from "@/game/training/neuralNet";
import { encodeVector, VECTOR_SIZE } from "@/game/training/stateExtractor";

export interface DQNConfig {
  learningRate: number;
  gamma: number;
  epsilon: number;
  epsilonDecay: number;
  epsilonMin: number;
  hiddenSize: number;
  bufferSize: number;
  batchSize: number;
  /** Steps between copying the online network's weights into the target network. */
  targetUpdateInterval: number;
}

/**
 * A learning rate of 0.01 looked fine step-to-step but drove Q-values to
 * visibly diverge (then collapse) after ~100k steps — 0.001 stays stable
 * over a full run. Tabular Q-learning's epsilon schedule assumes ~150k
 * steps/sec of throughput annealing over ~1M steps; that doesn't transfer to
 * a network doing real gradient work per step, so this decays roughly 30x
 * faster with a higher floor, which is what was actually exercised here.
 */
export const DEFAULT_DQN_CONFIG: DQNConfig = {
  learningRate: 0.001,
  gamma: 0.97,
  epsilon: 1,
  epsilonDecay: 0.99997,
  epsilonMin: 0.05,
  hiddenSize: 16,
  bufferSize: 20000,
  batchSize: 32,
  targetUpdateInterval: 500,
};

export interface SerializedNeuralAgent {
  algorithm: "dqn";
  version: 1;
  config: DQNConfig;
  steps: number;
  weights: MLPWeights;
}

interface Transition {
  input: number[];
  action: Action;
  reward: number;
  nextInput: number[];
  done: boolean;
}

/**
 * DQN with experience replay and a target network — the two standard
 * stabilizers for bootstrapping off a network that is itself still changing.
 * The replay buffer is a fixed-size ring so long training sessions don't
 * grow without bound.
 */
export class NeuralQAgent {
  readonly algorithm = "dqn" as const;
  private config: DQNConfig;
  private net: MLP;
  private targetNet: MLP;
  private buffer: Transition[] = [];
  private bufferCursor = 0;
  private steps = 0;

  constructor(config?: Partial<DQNConfig>, weights?: MLPWeights) {
    this.config = { ...DEFAULT_DQN_CONFIG, ...config };
    this.net = new MLP(VECTOR_SIZE, this.config.hiddenSize, 2, weights);
    this.targetNet = this.net.clone();
  }

  get epsilon(): number {
    return this.config.epsilon;
  }

  /** Transitions currently held in the replay buffer — this agent has no discrete state table. */
  get stateCount(): number {
    return this.buffer.length;
  }

  configure(config: Partial<DQNConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): DQNConfig {
    return { ...this.config };
  }

  reset(): void {
    this.net = new MLP(VECTOR_SIZE, this.config.hiddenSize, 2);
    this.targetNet = this.net.clone();
    this.buffer = [];
    this.bufferCursor = 0;
    this.steps = 0;
    this.config = { ...this.config, epsilon: DEFAULT_DQN_CONFIG.epsilon };
  }

  getAction(observation: Observation): Action {
    if (Math.random() < this.config.epsilon) {
      return Math.random() < 0.5 ? 0 : 1;
    }
    return this.getGreedyAction(observation);
  }

  getGreedyAction(observation: Observation): Action {
    const q = this.net.predict(encodeVector(observation));
    return q[1] > q[0] ? 1 : 0;
  }

  /** Raw [hold, release] Q-value estimates — useful for inspecting what the network has learned. */
  predictQValues(observation: Observation): [number, number] {
    const [hold, release] = this.net.predict(encodeVector(observation));
    return [hold, release];
  }

  update(
    observation: Observation,
    action: Action,
    reward: number,
    nextObservation: Observation,
    done: boolean,
  ): void {
    const transition: Transition = {
      input: encodeVector(observation),
      action,
      reward,
      nextInput: encodeVector(nextObservation),
      done,
    };

    if (this.buffer.length < this.config.bufferSize) {
      this.buffer.push(transition);
    } else {
      this.buffer[this.bufferCursor] = transition;
      this.bufferCursor = (this.bufferCursor + 1) % this.config.bufferSize;
    }

    this.trainOnBatch();

    this.steps += 1;
    this.config.epsilon = Math.max(
      this.config.epsilonMin,
      this.config.epsilon * this.config.epsilonDecay,
    );
    if (this.steps % this.config.targetUpdateInterval === 0) {
      this.targetNet.setWeights(this.net.getWeights());
    }
  }

  private trainOnBatch(): void {
    if (this.buffer.length < this.config.batchSize) {
      return;
    }
    const samples = [];
    for (let i = 0; i < this.config.batchSize; i++) {
      const sample = this.buffer[Math.floor(Math.random() * this.buffer.length)];
      const targetQ = this.targetNet.predict(sample.nextInput);
      const bestNext = sample.done ? 0 : Math.max(targetQ[0], targetQ[1]);
      samples.push({
        input: sample.input,
        actionIndex: sample.action,
        targetValue: sample.reward + this.config.gamma * bestNext,
      });
    }
    this.net.trainBatch(samples, this.config.learningRate);
  }

  serialize(): SerializedNeuralAgent {
    return {
      algorithm: "dqn",
      version: 1,
      config: this.config,
      steps: this.steps,
      weights: this.net.getWeights(),
    };
  }

  static deserialize(data: SerializedNeuralAgent): NeuralQAgent {
    const agent = new NeuralQAgent(data.config, data.weights);
    agent.steps = data.steps;
    return agent;
  }
}
