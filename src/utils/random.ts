/**
 * Deterministic xorshift32. Endless mode and the built-in level generator both
 * depend on a given seed always producing the same level.
 */
export class Random {
  private seed: number;

  constructor(seed: number) {
    // Xorshift is a fixed point at zero, so fold empty seeds onto a constant.
    this.seed = (seed >>> 0) || 0x9e3779b9;
  }

  next(): number {
    this.seed ^= this.seed << 13;
    this.seed >>>= 0;
    this.seed ^= this.seed >>> 17;
    this.seed ^= this.seed << 5;
    this.seed >>>= 0;
    return this.seed / 0x100000000;
  }

  /** Float in [min, max). */
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /** Integer in [min, max]. */
  int(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1));
  }

  chance(probability: number): boolean {
    return this.next() < probability;
  }

  pick<T>(items: readonly T[]): T {
    return items[Math.floor(this.next() * items.length)];
  }

  /** Picks by relative weight; weights need not sum to one. */
  weighted<T>(items: readonly { value: T; weight: number }[]): T {
    const total = items.reduce((sum, item) => sum + item.weight, 0);
    let roll = this.next() * total;
    for (const item of items) {
      roll -= item.weight;
      if (roll <= 0) {
        return item.value;
      }
    }
    return items[items.length - 1].value;
  }
}

export function randomSeed(): number {
  return Math.floor(Math.random() * 0xffffffff) >>> 0;
}
