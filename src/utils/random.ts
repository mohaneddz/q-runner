export class Random {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed >>> 0;
  }

  next(): number {
    this.seed ^= this.seed << 13;
    this.seed ^= this.seed >>> 17;
    this.seed ^= this.seed << 5;
    return (this.seed >>> 0) / 4294967295;
  }
}
