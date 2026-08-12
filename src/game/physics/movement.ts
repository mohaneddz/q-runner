import { GRAVITY, MAX_FALL_SPEED, PLAYER_ROTATE_SPEED } from "@/game/core/constants";
import type { PlayerState } from "@/game/core/types";
import { clamp } from "@/utils/math";

export function integrateMovement(player: PlayerState, dt: number): void {
  player.vy = clamp(player.vy + GRAVITY * dt, -Infinity, MAX_FALL_SPEED);
  player.x += player.vx * dt;
  player.y += player.vy * dt;

  if (!player.grounded) {
    player.rotation += PLAYER_ROTATE_SPEED * dt;
  } else {
    player.rotation = 0;
  }
}

export function applyJumpImpulse(player: PlayerState, jumpVelocity: number): void {
  if (player.grounded) {
    player.vy = jumpVelocity;
    player.grounded = false;
  }
}
