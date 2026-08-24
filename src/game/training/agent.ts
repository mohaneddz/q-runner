import { NeuralQAgent, type SerializedNeuralAgent } from "@/game/training/dqn";
import { QLearningAgent, type SerializedQLearningAgent } from "@/game/training/qlearning";

export type AlgorithmId = "qlearning" | "dqn";

export const ALGORITHMS: { id: AlgorithmId; label: string }[] = [
  { id: "qlearning", label: "Tabular Q-learning" },
  { id: "dqn", label: "Deep Q-learning (DQN)" },
];

/**
 * Every agent Trainer can drive. Kept as a union of the concrete classes
 * (rather than a separate interface) so `agent.algorithm` narrows straight to
 * the right class wherever an agent is pulled off a trainer.
 */
export type RLAgent = QLearningAgent | NeuralQAgent;

export type SerializedAgent = SerializedQLearningAgent | SerializedNeuralAgent;

export function createAgent(algorithm: AlgorithmId): RLAgent {
  return algorithm === "dqn" ? new NeuralQAgent() : new QLearningAgent();
}

export function deserializeAgent(data: SerializedAgent): RLAgent {
  return data.algorithm === "dqn" ? NeuralQAgent.deserialize(data) : QLearningAgent.deserialize(data);
}
