export class Platform {
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

  get bottom(): number {
    return this.y + this.height;
  }
}
