import type { Action, InputProvider, Observation } from "@/game/core/types";

export type PolicyFn = (state: Observation) => Action;

export class AgentInput implements InputProvider {
  constructor(private readonly policy: PolicyFn) {}

  getAction(state: Observation): Action {
    return this.policy(state);
  }
}

export function createHeuristicPolicy(): PolicyFn {
  return (state) => {
    if (state.grounded && state.distanceToNextObstacle < 110 && state.obstacleHeight > 0) {
      return 1;
    }
    return 0;
  };
}
