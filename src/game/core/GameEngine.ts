import {
  CANVAS_WIDTH,
  DEATH_REWARD,
  FIXED_DT,
  PASS_REWARD,
  PLAYER_JUMP_IMPULSE,
  PLAYER_START_X,
  PLAYER_START_Y,
  SURVIVE_REWARD,
} from "@/game/core/constants";
import type { InputProvider, Observation, Snapshot, StepResult } from "@/game/core/types";
import { Finish } from "@/game/entities/Finish";
import { Platform } from "@/game/entities/Platform";
import { Player } from "@/game/entities/Player";
import { Spike } from "@/game/entities/Spike";
import type { LevelData, LevelObject } from "@/game/level/levelTypes";
import { collidesWithSpikes, reachedFinish, resolvePlatformCollisions } from "@/game/physics/collision";
import { applyJumpImpulse, integrateMovement } from "@/game/physics/movement";
import { clamp } from "@/utils/math";

export class GameEngine {
  private readonly player = new Player(PLAYER_START_X, PLAYER_START_Y);
  private readonly platforms: Platform[];
  private readonly spikes: Spike[];
  private readonly finish: Finish;
  private readonly obstaclePass = new Set<string>();
  private tickCount = 0;
  private status: "running" | "dead" | "finished" = "running";
  private lastReward = 0;
  private totalReward = 0;

  constructor(
    private readonly level: LevelData,
    private readonly inputProvider: InputProvider,
  ) {
    this.platforms = level.objects
      .filter((object) => object.type === "platform")
      .map((object) => new Platform(object.id, object.x, object.y, object.width, object.height));

    this.spikes = level.objects
      .filter((object) => object.type === "spike")
      .map((object) => new Spike(object.id, object.x, object.y, object.width, object.height));

    this.finish = new Finish(level.length - 24, 0, 24, 720);
  }

  reset(): void {
    this.player.reset(PLAYER_START_X, PLAYER_START_Y);
    this.obstaclePass.clear();
    this.status = "running";
    this.lastReward = 0;
    this.totalReward = 0;
    this.tickCount = 0;
  }

  step(forcedAction?: 0 | 1): StepResult {
    if (this.status !== "running") {
      return {
        reward: 0,
        done: true,
        passedObstacle: false,
        status: this.status,
        observation: this.getObservation(),
      };
    }

    const action = forcedAction ?? this.inputProvider.getAction(this.getObservation());
    if (action === 1) {
      applyJumpImpulse(this.player.state, PLAYER_JUMP_IMPULSE);
    }

    const previousY = this.player.state.y;
    integrateMovement(this.player.state, FIXED_DT);
    resolvePlatformCollisions(this.player.state, previousY, this.platforms);

    let reward = SURVIVE_REWARD;
    let passedObstacle = false;

    for (const spike of this.spikes) {
      if (this.player.state.x > spike.right && !this.obstaclePass.has(spike.id)) {
        this.obstaclePass.add(spike.id);
        reward += PASS_REWARD;
        passedObstacle = true;
      }
    }

    if (collidesWithSpikes(this.player.state, this.spikes)) {
      this.status = "dead";
      reward += DEATH_REWARD;
    } else if (reachedFinish(this.player.state, this.finish)) {
      this.status = "finished";
      reward += 5;
    }

    this.lastReward = reward;
    this.totalReward += reward;
    this.tickCount += 1;

    return {
      reward,
      done: this.status !== "running",
      passedObstacle,
      status: this.status,
      observation: this.getObservation(),
    };
  }

  getObservation(): Observation {
    const player = this.player.state;
    const nextSpike = this.spikes.find((spike) => spike.x + spike.width >= player.x);

    return {
      distanceToNextObstacle: nextSpike ? Math.max(0, nextSpike.x - (player.x + player.width)) : 9999,
      obstacleHeight: nextSpike ? nextSpike.height : 0,
      verticalVelocity: player.vy,
      grounded: player.grounded ? 1 : 0,
    };
  }

  getSnapshot(): Snapshot {
    const player = this.player.state;
    const cameraX = clamp(player.x - 220, 0, Math.max(0, this.level.length - CANVAS_WIDTH));
    return {
      player: { ...player },
      level: this.level,
      cameraX,
      status: this.status,
      reward: this.lastReward,
      totalReward: this.totalReward,
      progress: clamp(player.x / this.level.length, 0, 1),
      tick: this.tickCount,
      observation: this.getObservation(),
      objects: this.level.objects as LevelObject[],
    };
  }

  getStatus(): "running" | "dead" | "finished" {
    return this.status;
  }
}
