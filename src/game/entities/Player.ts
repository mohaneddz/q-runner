import { PLAYER_SIZE, PLAYER_SPEED } from "@/game/core/constants";
import type { PlayerState } from "@/game/core/types";

export class Player {
  state: PlayerState;

  constructor(x: number, y: number) {
    this.state = {
      x,
      y,
      width: PLAYER_SIZE,
      height: PLAYER_SIZE,
      vx: PLAYER_SPEED,
      vy: 0,
      grounded: false,
      rotation: 0,
    };
  }

  reset(x: number, y: number): void {
    this.state.x = x;
    this.state.y = y;
    this.state.vx = PLAYER_SPEED;
    this.state.vy = 0;
    this.state.grounded = false;
    this.state.rotation = 0;
  }
}
