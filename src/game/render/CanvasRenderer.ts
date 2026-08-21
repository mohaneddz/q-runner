import { CAMERA_ANCHOR, CAMERA_FLOOR, PLAYER_SIZE, UNITS_PER_SCREEN } from "@/game/core/constants";
import type { Snapshot } from "@/game/core/types";
import { drawObject, type ViewTransform } from "@/game/render/drawObjects";
import { resolveTheme, type Theme } from "@/game/render/themes";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
}

const TRAIL_INTERVAL = 0.03;
const MAX_PARTICLES = 260;

export class CanvasRenderer {
  private readonly ctx: CanvasRenderingContext2D;
  private width = 1280;
  private height = 720;
  private scale = 1280 / UNITS_PER_SCREEN;

  private cameraX = 0;
  private cameraY = CAMERA_FLOOR;
  private playerRotation = 0;
  private particles: Particle[] = [];
  private trailTimer = 0;
  private shake = 0;
  private lastStatus: Snapshot["status"] = "running";
  private initialised = false;

  constructor(private readonly canvas: HTMLCanvasElement) {
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) {
      throw new Error("Canvas 2D context unavailable");
    }
    this.ctx = context;
  }

  /** Sizes the backing store to the display box so the render stays crisp. */
  resize(cssWidth: number, cssHeight: number, dpr = 1): void {
    const ratio = Math.min(dpr, 2);
    this.width = Math.max(1, Math.round(cssWidth));
    this.height = Math.max(1, Math.round(cssHeight));
    this.canvas.width = Math.round(this.width * ratio);
    this.canvas.height = Math.round(this.height * ratio);
    this.ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    this.scale = this.width / UNITS_PER_SCREEN;
  }

  private toScreenX = (worldX: number): number => (worldX - this.cameraX) * this.scale;

  private toScreenY = (worldY: number): number =>
    this.height - (worldY - this.cameraY) * this.scale;

  /** Handed to the shared object painters so the editor draws identically. */
  private get view(): ViewTransform {
    return { toScreenX: this.toScreenX, toScreenY: this.toScreenY, scale: this.scale };
  }

  private updateCamera(snapshot: Snapshot, dt: number): void {
    const targetX = snapshot.player.x - UNITS_PER_SCREEN * CAMERA_ANCHOR;
    const viewHeight = this.height / this.scale;
    const targetY = Math.max(CAMERA_FLOOR, snapshot.player.y - viewHeight * 0.38);

    if (!this.initialised) {
      this.cameraX = targetX;
      this.cameraY = targetY;
      this.initialised = true;
      return;
    }

    // Horizontal tracking is exact so the level never appears to rubber-band;
    // vertical lags slightly, which keeps ship sections from feeling jittery.
    this.cameraX = targetX;
    this.cameraY += (targetY - this.cameraY) * Math.min(1, dt * 9);
  }

  private spawnParticle(particle: Particle): void {
    if (this.particles.length >= MAX_PARTICLES) {
      this.particles.shift();
    }
    this.particles.push(particle);
  }

  private emitBurst(x: number, y: number, count: number, color: string, speed: number): void {
    for (let i = 0; i < count; i += 1) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
      const magnitude = speed * (0.4 + Math.random() * 0.8);
      this.spawnParticle({
        x,
        y,
        vx: Math.cos(angle) * magnitude,
        vy: Math.sin(angle) * magnitude,
        life: 0.5 + Math.random() * 0.4,
        maxLife: 0.9,
        size: 0.08 + Math.random() * 0.12,
        color,
      });
    }
  }

  private updateParticles(dt: number): void {
    for (const particle of this.particles) {
      particle.life -= dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vy -= 14 * dt;
    }
    this.particles = this.particles.filter((particle) => particle.life > 0);
  }

  private updateEffects(snapshot: Snapshot, dt: number, theme: Theme): void {
    const player = snapshot.player;
    const events = snapshot.events;

    if (player.grounded) {
      // Snap to the nearest quarter turn on landing, the way the cube reads.
      const quarter = Math.PI / 2;
      const target = Math.round(this.playerRotation / quarter) * quarter;
      this.playerRotation += (target - this.playerRotation) * Math.min(1, dt * 18);
    } else if (player.mode === "cube") {
      this.playerRotation += dt * 7.5 * player.gravity;
    } else if (player.mode === "ball") {
      this.playerRotation += dt * 9;
    } else {
      this.playerRotation = 0;
    }

    if (events.jumped) {
      this.emitBurst(player.x + PLAYER_SIZE / 2, player.y, 6, theme.accent, 2.2);
    }
    if (events.landed) {
      this.emitBurst(player.x + PLAYER_SIZE / 2, player.y, 5, theme.solidEdge, 1.8);
    }
    if (events.padHit || events.orbHit) {
      this.emitBurst(player.x + PLAYER_SIZE / 2, player.y + PLAYER_SIZE / 2, 12, theme.accent, 3.4);
    }
    if (events.portalHit) {
      this.emitBurst(player.x + PLAYER_SIZE / 2, player.y + PLAYER_SIZE / 2, 16, theme.hazard, 3);
    }

    if (snapshot.status === "dead" && this.lastStatus !== "dead") {
      this.emitBurst(player.x + PLAYER_SIZE / 2, player.y + PLAYER_SIZE / 2, 26, theme.hazard, 6);
      this.shake = 1;
    }
    this.lastStatus = snapshot.status;

    this.trailTimer -= dt;
    if (this.trailTimer <= 0 && snapshot.status === "running") {
      this.trailTimer = TRAIL_INTERVAL;
      this.spawnParticle({
        x: player.x + PLAYER_SIZE / 2,
        y: player.y + PLAYER_SIZE / 2,
        vx: -1.5,
        vy: 0,
        life: 0.35,
        maxLife: 0.35,
        size: 0.16,
        color: theme.playerEdge,
      });
    }

    this.shake = Math.max(0, this.shake - dt * 3);
    this.updateParticles(dt);
  }

  private drawBackground(theme: Theme): void {
    const ctx = this.ctx;
    const sky = ctx.createLinearGradient(0, 0, 0, this.height);
    sky.addColorStop(0, theme.skyTop);
    sky.addColorStop(1, theme.skyBottom);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, this.width, this.height);

    // Distant silhouettes for depth. They are deliberately sparse, tall and
    // faded to the point of being barely there — an earlier version used
    // platform-sized blocks at half opacity and they read as real terrain.
    ctx.save();
    for (const [depth, spacingUnits, widthUnits, heightFraction, alpha] of [
      [0.2, 23, 13, 0.52, 0.05],
      [0.42, 14, 7, 0.34, 0.06],
    ] as const) {
      const spacing = spacingUnits * this.scale;
      const columnWidth = widthUnits * this.scale;
      const columnHeight = this.height * heightFraction;
      const top = this.height - columnHeight;

      const fade = ctx.createLinearGradient(0, top, 0, this.height);
      fade.addColorStop(0, "transparent");
      fade.addColorStop(1, theme.glow);

      ctx.globalAlpha = alpha;
      ctx.fillStyle = fade;

      const offset = (-this.cameraX * this.scale * depth) % spacing;
      for (let x = offset - spacing; x < this.width + spacing; x += spacing) {
        ctx.fillRect(x, top, columnWidth, columnHeight);
      }
    }
    ctx.restore();

    ctx.strokeStyle = theme.grid;
    ctx.lineWidth = 1;
    const step = this.scale;
    const startX = -((this.cameraX * this.scale) % step);
    for (let x = startX; x < this.width; x += step) {
      ctx.beginPath();
      ctx.moveTo(Math.round(x) + 0.5, 0);
      ctx.lineTo(Math.round(x) + 0.5, this.height);
      ctx.stroke();
    }
    const startY = this.toScreenY(Math.ceil(this.cameraY));
    for (let y = startY; y > -step; y -= step) {
      ctx.beginPath();
      ctx.moveTo(0, Math.round(y) + 0.5);
      ctx.lineTo(this.width, Math.round(y) + 0.5);
      ctx.stroke();
    }
  }

  private drawPlayer(snapshot: Snapshot, theme: Theme): void {
    const ctx = this.ctx;
    const player = snapshot.player;
    if (snapshot.status === "dead") {
      return;
    }

    const size = PLAYER_SIZE * this.scale;
    const centreX = this.toScreenX(player.x + PLAYER_SIZE / 2);
    const centreY = this.toScreenY(player.y + PLAYER_SIZE / 2);

    ctx.save();
    ctx.translate(centreX, centreY);

    ctx.shadowColor = theme.playerEdge;
    ctx.shadowBlur = this.scale * 0.4;
    ctx.fillStyle = theme.player;
    ctx.strokeStyle = theme.playerEdge;
    ctx.lineWidth = 2;

    if (player.mode === "ship") {
      ctx.rotate(Math.max(-0.6, Math.min(0.6, (-player.vy / 12) * player.gravity)) * -player.gravity);
      ctx.beginPath();
      ctx.moveTo(size * 0.6, 0);
      ctx.lineTo(-size * 0.5, -size * 0.42);
      ctx.lineTo(-size * 0.3, 0);
      ctx.lineTo(-size * 0.5, size * 0.42);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (player.mode === "ball") {
      ctx.rotate(this.playerRotation);
      ctx.beginPath();
      ctx.arc(0, 0, size / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, -size / 2);
      ctx.lineTo(0, size / 2);
      ctx.stroke();
    } else {
      ctx.rotate(this.playerRotation);
      ctx.beginPath();
      ctx.roundRect(-size / 2, -size / 2, size, size, size * 0.16);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = theme.playerEdge;
      ctx.fillRect(-size * 0.18, -size * 0.18, size * 0.36, size * 0.36);
    }

    ctx.restore();
  }

  private drawParticles(): void {
    const ctx = this.ctx;
    for (const particle of this.particles) {
      ctx.globalAlpha = Math.max(0, particle.life / particle.maxLife) * 0.8;
      ctx.fillStyle = particle.color;
      const size = particle.size * this.scale;
      ctx.fillRect(
        this.toScreenX(particle.x) - size / 2,
        this.toScreenY(particle.y) - size / 2,
        size,
        size,
      );
    }
    ctx.globalAlpha = 1;
  }

  render(snapshot: Snapshot, dt: number): void {
    const theme = resolveTheme(snapshot.level.settings.theme);
    const time = snapshot.tick / 120;

    this.updateCamera(snapshot, dt);
    this.updateEffects(snapshot, dt, theme);

    const ctx = this.ctx;
    ctx.save();
    if (this.shake > 0) {
      const magnitude = this.shake * this.scale * 0.12;
      ctx.translate((Math.random() - 0.5) * magnitude, (Math.random() - 0.5) * magnitude);
    }

    this.drawBackground(theme);

    const viewLeft = this.cameraX - 2;
    const viewRight = this.cameraX + UNITS_PER_SCREEN + 2;

    for (const object of snapshot.objects) {
      if (object.right < viewLeft || object.x > viewRight) {
        continue;
      }
      drawObject(ctx, object, theme, this.view, time);
    }

    this.drawParticles();
    this.drawPlayer(snapshot, theme);
    ctx.restore();
  }

  /** Clears transient effects so a restart does not inherit the last death. */
  resetEffects(): void {
    this.particles = [];
    this.shake = 0;
    this.playerRotation = 0;
    this.initialised = false;
    this.lastStatus = "running";
  }
}
