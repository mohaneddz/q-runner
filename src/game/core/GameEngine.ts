import {
  DEATH_REWARD,
  FINISH_REWARD,
  PLAYER_START_X,
  PLAYER_START_Y,
  PLAYER_START_Y_FLIPPED,
  PROGRESS_REWARD,
  SURVIVE_REWARD,
} from "@/game/core/constants";
import { extractObservation } from "@/game/core/observation";
import {
  cloneSimState,
  createSimState,
  stepSimulation,
  type SimEvents,
  type SimState,
} from "@/game/core/simulation";
import type { Action, InputProvider, Observation, RunStatus, Snapshot, StepResult } from "@/game/core/types";
import { createLevelContext, type LevelContext } from "@/game/level/levelGeometry";
import type { LevelData } from "@/game/level/levelSchema";

const NO_EVENTS: SimEvents = {
  jumped: false,
  landed: false,
  padHit: false,
  orbHit: false,
  portalHit: false,
};

export class GameEngine {
  private readonly context: LevelContext;
  private state: SimState;
  private status: RunStatus = "running";
  private events: SimEvents = NO_EVENTS;
  private tickCount = 0;
  private attemptCount = 1;
  private furthestX: number;
  private totalReward = 0;

  constructor(
    private readonly level: LevelData,
    private inputProvider: InputProvider,
  ) {
    this.context = createLevelContext(level);
    this.state = this.spawn();
    this.furthestX = this.state.x;
    this.inputProvider.reset?.();
  }

  private spawn(): SimState {
    const { startMode, startGravity } = this.level.settings;
    const y = startGravity === 1 ? PLAYER_START_Y : PLAYER_START_Y_FLIPPED;
    return createSimState(startMode, startGravity, PLAYER_START_X, y);
  }

  setInputProvider(provider: InputProvider): void {
    this.inputProvider = provider;
  }

  /** Restarts the run. Counts as a new attempt unless this is a fresh load. */
  reset(countAttempt = true): void {
    this.state = this.spawn();
    this.status = "running";
    this.events = NO_EVENTS;
    this.tickCount = 0;
    this.furthestX = this.state.x;
    this.totalReward = 0;
    this.inputProvider.reset?.();
    if (countAttempt) {
      this.attemptCount += 1;
    }
  }

  step(forcedAction?: Action): StepResult {
    if (this.status !== "running") {
      return {
        reward: 0,
        done: true,
        status: this.status,
        observation: this.getObservation(),
        events: NO_EVENTS,
      };
    }

    const action = forcedAction ?? this.inputProvider.getAction(this.getObservation());
    const outcome = stepSimulation(this.state, action === 1, this.context);
    this.events = outcome.events;
    this.tickCount += 1;

    let reward = SURVIVE_REWARD;
    if (this.state.x > this.furthestX) {
      reward += (this.state.x - this.furthestX) * PROGRESS_REWARD;
      this.furthestX = this.state.x;
    }

    if (outcome.finished) {
      this.status = "finished";
      reward += FINISH_REWARD;
    } else if (outcome.dead) {
      this.status = "dead";
      reward += DEATH_REWARD;
    }

    this.totalReward += reward;

    return {
      reward,
      done: this.status !== "running",
      status: this.status,
      observation: this.getObservation(),
      events: outcome.events,
    };
  }

  getObservation(): Observation {
    return extractObservation(this.state, this.context);
  }

  getSnapshot(): Snapshot {
    return {
      player: cloneSimState(this.state),
      level: this.level,
      objects: this.context.objects,
      cameraX: this.state.x,
      status: this.status,
      // The finish gate sits a few units short of the nominal length, so a
      // cleared run would otherwise report 96% rather than complete.
      progress:
        this.status === "finished"
          ? 1
          : Math.max(0, Math.min(1, this.furthestX / this.level.settings.length)),
      tick: this.tickCount,
      attempt: this.attemptCount,
      totalReward: this.totalReward,
      observation: this.getObservation(),
      events: this.events,
    };
  }

  getStatus(): RunStatus {
    return this.status;
  }

  getLevel(): LevelData {
    return this.level;
  }
}
