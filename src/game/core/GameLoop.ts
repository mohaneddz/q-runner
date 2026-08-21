/** Largest frame the loop will simulate; anything longer is treated as a stall. */
const MAX_FRAME_SECONDS = 0.25;

/**
 * Fixed-step simulation decoupled from rendering. The step callback always
 * sees the same dt, which is what makes runs reproducible regardless of the
 * display refresh rate.
 */
export class GameLoop {
  private accumulator = 0;
  private lastTime = 0;
  private rafId: number | null = null;
  private running = false;

  constructor(
    private readonly fixedDt: number,
    private readonly step: () => void,
    private readonly render: (frameDelta: number) => void,
  ) {}

  start(): void {
    if (this.running) {
      return;
    }
    this.running = true;
    this.accumulator = 0;
    this.lastTime = performance.now();
    this.rafId = requestAnimationFrame(this.tick);
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
    this.rafId = requestAnimationFrame(this.tick);

    const frameDelta = Math.min((now - this.lastTime) / 1000, MAX_FRAME_SECONDS);
    this.lastTime = now;
    this.accumulator += frameDelta;

    // Bound the catch-up work so a background tab does not return and then
    // simulate thousands of ticks in one frame.
    const maxSteps = Math.ceil(MAX_FRAME_SECONDS / this.fixedDt);
    let steps = 0;
    while (this.accumulator >= this.fixedDt && steps < maxSteps) {
      this.step();
      this.accumulator -= this.fixedDt;
      steps += 1;
    }
    if (steps >= maxSteps) {
      this.accumulator = 0;
    }

    this.render(frameDelta);
  };
}
