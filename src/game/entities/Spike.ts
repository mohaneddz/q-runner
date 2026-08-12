export class Spike {
  constructor(
    public readonly id: string,
    public x: number,
    public y: number,
    public width: number,
    public height: number,
  ) {}

  get right(): number {
    return this.x + this.width;
  }
}
