import { PLAYER_SIZE, PLAYER_START_X, PLAYER_START_Y, PLAYER_START_Y_FLIPPED } from "@/game/core/constants";
import type { ResolvedObject } from "@/game/level/levelGeometry";
import type { LevelData } from "@/game/level/levelSchema";
import { drawObject, type ViewTransform } from "@/game/render/drawObjects";
import { resolveTheme } from "@/game/render/themes";

/** World units across the editor viewport at 100% zoom. */
export const EDITOR_UNITS_PER_SCREEN = 32;

export interface EditorCamera {
  x: number;
  y: number;
  zoom: number;
}

export interface Marquee {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface EditorFrame {
  level: LevelData;
  objects: ResolvedObject[];
  selectedIds: string[];
  hoveredId: string | null;
  marquee: Marquee | null;
  camera: EditorCamera;
  /** Ghost of the object that would be placed at the cursor. */
  preview: ResolvedObject | null;
}

export class EditorRenderer {
  private readonly ctx: CanvasRenderingContext2D;
  private width = 1280;
  private height = 720;
  private scale = 40;
  private camera: EditorCamera = { x: 0, y: 0, zoom: 1 };

  constructor(private readonly canvas: HTMLCanvasElement) {
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) {
      throw new Error("Canvas 2D context unavailable");
    }
    this.ctx = context;
  }

  resize(cssWidth: number, cssHeight: number, dpr = 1): void {
    const ratio = Math.min(dpr, 2);
    this.width = Math.max(1, Math.round(cssWidth));
    this.height = Math.max(1, Math.round(cssHeight));
    this.canvas.width = Math.round(this.width * ratio);
    this.canvas.height = Math.round(this.height * ratio);
    this.ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  get viewportUnits(): { width: number; height: number } {
    return { width: this.width / this.scale, height: this.height / this.scale };
  }

  toScreenX = (worldX: number): number => (worldX - this.camera.x) * this.scale;

  toScreenY = (worldY: number): number => this.height - (worldY - this.camera.y) * this.scale;

  toWorldX = (screenX: number): number => screenX / this.scale + this.camera.x;

  toWorldY = (screenY: number): number => (this.height - screenY) / this.scale + this.camera.y;

  private get view(): ViewTransform {
    return { toScreenX: this.toScreenX, toScreenY: this.toScreenY, scale: this.scale };
  }

  private drawGrid(): void {
    const ctx = this.ctx;
    const { width: unitsWide, height: unitsTall } = this.viewportUnits;
    // Coarsen the grid when zoomed out so it never turns into a solid block.
    const step = this.scale < 14 ? 4 : this.scale < 28 ? 2 : 1;

    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(140, 170, 220, 0.1)";
    ctx.beginPath();
    for (let x = Math.floor(this.camera.x / step) * step; x < this.camera.x + unitsWide; x += step) {
      const screenX = Math.round(this.toScreenX(x)) + 0.5;
      ctx.moveTo(screenX, 0);
      ctx.lineTo(screenX, this.height);
    }
    for (let y = Math.floor(this.camera.y / step) * step; y < this.camera.y + unitsTall; y += step) {
      const screenY = Math.round(this.toScreenY(y)) + 0.5;
      ctx.moveTo(0, screenY);
      ctx.lineTo(this.width, screenY);
    }
    ctx.stroke();

    // The ground line is the reference every chunk is built against.
    ctx.strokeStyle = "rgba(32, 241, 255, 0.35)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    const groundY = Math.round(this.toScreenY(0)) + 0.5;
    ctx.moveTo(0, groundY);
    ctx.lineTo(this.width, groundY);
    ctx.stroke();
  }

  private drawBounds(level: LevelData): void {
    const ctx = this.ctx;
    const startX = this.toScreenX(0);
    const endX = this.toScreenX(level.settings.length);

    ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
    if (startX > 0) {
      ctx.fillRect(0, 0, startX, this.height);
    }
    if (endX < this.width) {
      ctx.fillRect(endX, 0, this.width - endX, this.height);
    }

    ctx.strokeStyle = "rgba(129, 255, 111, 0.6)";
    ctx.setLineDash([6, 6]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(endX, 0);
    ctx.lineTo(endX, this.height);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  private drawSpawn(level: LevelData): void {
    const ctx = this.ctx;
    const y = level.settings.startGravity === 1 ? PLAYER_START_Y : PLAYER_START_Y_FLIPPED;
    const size = PLAYER_SIZE * this.scale;

    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(this.toScreenX(PLAYER_START_X), this.toScreenY(y + PLAYER_SIZE), size, size);
    ctx.setLineDash([]);

    ctx.fillStyle = "rgba(255,255,255,0.65)";
    ctx.font = "600 11px ui-sans-serif, system-ui, sans-serif";
    ctx.fillText("start", this.toScreenX(PLAYER_START_X), this.toScreenY(y + PLAYER_SIZE) - 6);
  }

  private outline(object: ResolvedObject, color: string, lineWidth: number): void {
    const ctx = this.ctx;
    const x = this.toScreenX(object.x);
    const y = this.toScreenY(object.top);
    const width = object.width * this.scale;
    const height = object.height * this.scale;

    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.strokeRect(x - 2, y - 2, width + 4, height + 4);
  }

  private drawHandles(object: ResolvedObject): void {
    const ctx = this.ctx;
    const x = this.toScreenX(object.x);
    const y = this.toScreenY(object.top);
    const width = object.width * this.scale;
    const height = object.height * this.scale;
    const size = 7;

    ctx.fillStyle = "#81ff6f";
    for (const [handleX, handleY] of [
      [x, y],
      [x + width, y],
      [x, y + height],
      [x + width, y + height],
    ]) {
      ctx.fillRect(handleX - size / 2, handleY - size / 2, size, size);
    }
  }

  render(frame: EditorFrame): void {
    this.camera = frame.camera;
    this.scale = (this.width / EDITOR_UNITS_PER_SCREEN) * frame.camera.zoom;

    const ctx = this.ctx;
    const theme = resolveTheme(frame.level.settings.theme);

    ctx.fillStyle = theme.skyBottom;
    ctx.fillRect(0, 0, this.width, this.height);

    this.drawGrid();
    this.drawBounds(frame.level);

    const { width: unitsWide } = this.viewportUnits;
    const viewLeft = this.camera.x - 4;
    const viewRight = this.camera.x + unitsWide + 4;

    for (const object of frame.objects) {
      if (object.right < viewLeft || object.x > viewRight) {
        continue;
      }
      drawObject(ctx, object, theme, this.view);

      if (frame.selectedIds.includes(object.id)) {
        this.outline(object, "#81ff6f", 2);
      } else if (object.id === frame.hoveredId) {
        this.outline(object, "rgba(255,255,255,0.45)", 1.5);
      }
    }

    if (frame.selectedIds.length === 1) {
      const selected = frame.objects.find((object) => object.id === frame.selectedIds[0]);
      if (selected) {
        this.drawHandles(selected);
      }
    }

    if (frame.preview) {
      ctx.globalAlpha = 0.45;
      drawObject(ctx, frame.preview, theme, this.view);
      ctx.globalAlpha = 1;
      this.outline(frame.preview, "rgba(32, 241, 255, 0.7)", 1.5);
    }

    this.drawSpawn(frame.level);

    if (frame.marquee) {
      const x = this.toScreenX(frame.marquee.x);
      const y = this.toScreenY(frame.marquee.y + frame.marquee.height);
      ctx.fillStyle = "rgba(32, 241, 255, 0.12)";
      ctx.strokeStyle = "rgba(32, 241, 255, 0.7)";
      ctx.lineWidth = 1;
      ctx.fillRect(x, y, frame.marquee.width * this.scale, frame.marquee.height * this.scale);
      ctx.strokeRect(x, y, frame.marquee.width * this.scale, frame.marquee.height * this.scale);
    }
  }
}
