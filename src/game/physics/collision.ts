import type { PlayerState } from "@/game/core/types";
import type { Finish } from "@/game/entities/Finish";
import type { Platform } from "@/game/entities/Platform";
import type { Spike } from "@/game/entities/Spike";
import { pointInTriangle } from "@/utils/math";

function overlaps(
  ax: number,
  ay: number,
  aw: number,
  ah: number,
  bx: number,
  by: number,
  bw: number,
  bh: number,
): boolean {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

export function resolvePlatformCollisions(
  player: PlayerState,
  previousY: number,
  platforms: Platform[],
): void {
  player.grounded = false;

  for (const platform of platforms) {
    if (
      !overlaps(
        player.x,
        player.y,
        player.width,
        player.height,
        platform.x,
        platform.y,
        platform.width,
        platform.height,
      )
    ) {
      continue;
    }

    const prevBottom = previousY + player.height;
    if (prevBottom <= platform.y && player.vy >= 0) {
      player.y = platform.y - player.height;
      player.vy = 0;
      player.grounded = true;
      continue;
    }

    const prevTop = previousY;
    if (prevTop >= platform.bottom && player.vy < 0) {
      player.y = platform.bottom;
      player.vy = 0;
    }
  }
}

export function hitsSpike(player: PlayerState, spike: Spike): boolean {
  if (
    !overlaps(player.x, player.y, player.width, player.height, spike.x, spike.y, spike.width, spike.height)
  ) {
    return false;
  }

  const ax = spike.x;
  const ay = spike.y + spike.height;
  const bx = spike.x + spike.width;
  const by = spike.y + spike.height;
  const cx = spike.x + spike.width / 2;
  const cy = spike.y;

  const points = [
    [player.x, player.y + player.height],
    [player.x + player.width, player.y + player.height],
    [player.x + player.width / 2, player.y + player.height],
    [player.x + player.width / 2, player.y + player.height / 2],
  ];

  return points.some(([px, py]) => pointInTriangle(px, py, ax, ay, bx, by, cx, cy));
}

export function collidesWithSpikes(player: PlayerState, spikes: Spike[]): boolean {
  return spikes.some((spike) => hitsSpike(player, spike));
}

export function reachedFinish(player: PlayerState, finish: Finish): boolean {
  return player.x + player.width >= finish.x;
}
