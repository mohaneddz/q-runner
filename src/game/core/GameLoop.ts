export class GameLoop {
  private accumulator = 0;
  private lastTime = 0;
  private rafId: number | null = null;
  private running = false;

  constructor(
    private readonly fixedDt: number,
    private readonly step: () => void,
    private readonly render: () => void,
  ) {}

  start(): void {
    if (this.running) {
      return;
    }
    this.running = true;
    this.accumulator = 0;
    this.lastTime = performance.now();
    this.tick(this.lastTime);
  }

  stop(): void {
    this.running = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private tick = (now: number): void => {
    if (!this.running) {
      return;
    }

    const frameDelta = Math.min((now - this.lastTime) / 1000, 0.1);
    this.lastTime = now;
    this.accumulator += frameDelta;

    while (this.accumulator >= this.fixedDt) {
      this.step();
      this.accumulator -= this.fixedDt;
    }

    this.render();
    this.rafId = requestAnimationFrame(this.tick);
  };
}
