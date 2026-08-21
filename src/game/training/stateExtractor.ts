import type { Observation } from "@/game/core/types";

function bucket(value: number, size: number, max: number): number {
  return Math.max(0, Math.min(max, Math.floor(value / size)));
}

/** Vertical speed spans -32..32; nine signed buckets keep the table small. */
function velocityBucket(velocity: number): number {
  return Math.max(-4, Math.min(4, Math.round(velocity / 4)));
}

function hazardHeightBucket(height: number): number {
  if (height <= 0) return 0;
  if (height <= 0.5) return 1;
  if (height <= 1) return 2;
  return 3;
}

/**
 * The three modes are steered by completely different quantities, so they get
 * their own encodings rather than one shared vector padded with zeros. That
 * keeps the table in the low tens of thousands of entries, which tabular
 * Q-learning can actually fill in a few hundred thousand steps.
 */
export function encodeState(observation: Observation): string {
  if (observation.mode === "ship") {
    return [
      "s",
      bucket(Math.max(0, -observation.surfaceDelta), 0.75, 7),
      bucket(observation.ceilingAbove, 0.75, 7),
      velocityBucket(observation.verticalVelocity),
      bucket(observation.distanceToHazard, 2, 5),
    ].join(",");
  }

  if (observation.mode === "ball") {
    return [
      "b",
      observation.grounded,
      bucket(Math.max(0, -observation.surfaceDelta), 0.75, 7),
      bucket(observation.distanceToHazard, 2, 5),
      velocityBucket(observation.verticalVelocity),
    ].join(",");
  }

  return [
    "c",
    observation.grounded,
    bucket(observation.distanceToHazard, 1, 8),
    hazardHeightBucket(observation.hazardHeight),
    bucket(observation.distanceToGap, 1.5, 6),
    bucket(observation.gapAhead, 1.5, 3),
    velocityBucket(observation.verticalVelocity),
  ].join(",");
}
