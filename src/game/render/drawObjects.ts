import type { ResolvedObject } from "@/game/level/levelGeometry";
import type { Theme } from "@/game/render/themes";

/**
 * World-to-screen mapping. Shared so the editor and the game draw the exact
 * same shapes — what you place is what you play.
 */
export interface ViewTransform {
  toScreenX(worldX: number): number;
  toScreenY(worldY: number): number;
  /** Pixels per world unit. */
  scale: number;
}

/**
 * Interactive objects keep the same colour in every theme. A "yellow orb" that
 * renders grey because the theme's accent happens to be grey is unreadable,
 * and these are the objects a player has to identify at speed.
 */
const FIXED_COLORS: Partial<Record<ResolvedObject["type"], string>> = {
  yellowPad: "#ffd166",
  yellowOrb: "#ffd166",
  pinkPad: "#ff4dbf",
  pinkOrb: "#ff4dbf",
  cubePortal: "#20f1ff",
  shipPortal: "#81ff6f",
  ballPortal: "#ff4dbf",
  gravityUpPortal: "#ffd166",
  gravityDownPortal: "#ff9f5a",
};

function drawSolid(ctx: CanvasRenderingContext2D, object: ResolvedObject, theme: Theme, view: ViewTransform) {
  const x = view.toScreenX(object.x);
  const y = view.toScreenY(object.top);
  const width = object.width * view.scale;
  const height = object.height * view.scale;

  ctx.fillStyle = theme.solidFill;
  ctx.fillRect(x, y, width, height);
  ctx.fillStyle = theme.solidEdge;
  ctx.fillRect(x, y, width, Math.max(2, view.scale * 0.07));
  ctx.strokeStyle = theme.solidEdge;
  ctx.globalAlpha = 0.35;
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, Math.max(1, width - 1), Math.max(1, height - 1));
  ctx.globalAlpha = 1;
}

function drawHazard(ctx: CanvasRenderingContext2D, object: ResolvedObject, theme: Theme, view: ViewTransform) {
  const inverted = object.type === "spikeInverted";
  const left = view.toScreenX(object.x);
  const right = view.toScreenX(object.right);
  const base = view.toScreenY(inverted ? object.top : object.y);
  const tip = view.toScreenY(inverted ? object.y : object.top);
  // Wide spikes read as a row of teeth rather than one oversized triangle.
  const teeth = Math.max(1, Math.round(object.width));
  const toothWidth = (right - left) / teeth;

  ctx.fillStyle = theme.hazard;
  ctx.strokeStyle = theme.hazardEdge;
  ctx.lineWidth = 1.5;

  for (let i = 0; i < teeth; i += 1) {
    const start = left + i * toothWidth;
    ctx.beginPath();
    ctx.moveTo(start, base);
    ctx.lineTo(start + toothWidth, base);
    ctx.lineTo(start + toothWidth / 2, tip);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
}

function drawPad(ctx: CanvasRenderingContext2D, object: ResolvedObject, view: ViewTransform) {
  const x = view.toScreenX(object.x);
  const y = view.toScreenY(object.top);
  const width = object.width * view.scale;
  const height = Math.max(3, object.height * view.scale);
  const color = FIXED_COLORS[object.type] ?? "#ffd166";

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, height / 2);
  ctx.fill();
  ctx.globalAlpha = 0.3;
  ctx.fillRect(x, y - height, width, height);
  ctx.globalAlpha = 1;
}

function drawOrb(
  ctx: CanvasRenderingContext2D,
  object: ResolvedObject,
  view: ViewTransform,
  time: number,
) {
  const centreX = view.toScreenX(object.x + object.width / 2);
  const centreY = view.toScreenY(object.y + object.height / 2);
  const radius = Math.max(3, (object.width / 2) * view.scale);
  const color = FIXED_COLORS[object.type] ?? "#ffd166";
  const pulse = 1 + Math.sin(time * 4 + object.x) * 0.12;

  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.globalAlpha = 0.5;
  ctx.beginPath();
  ctx.arc(centreX, centreY, radius * 1.5 * pulse, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(centreX, centreY, radius, 0, Math.PI * 2);
  ctx.fill();
}

function drawPortal(
  ctx: CanvasRenderingContext2D,
  object: ResolvedObject,
  view: ViewTransform,
  time: number,
) {
  const x = view.toScreenX(object.x);
  const y = view.toScreenY(object.top);
  const width = Math.max(6, object.width * view.scale);
  const height = Math.max(8, object.height * view.scale);
  const color = FIXED_COLORS[object.type] ?? "#20f1ff";

  ctx.save();
  ctx.globalAlpha = 0.2 + Math.sin(time * 3 + object.x) * 0.06;
  ctx.fillStyle = color;
  ctx.beginPath();
  // A halo just wider than the gate. An earlier version used 1.4x the width
  // as a radius, which drew a blob three units across for a one-unit portal.
  ctx.ellipse(x + width / 2, y + height / 2, width * 0.85, height / 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(x + width / 2, y + height / 2, width / 2, height / 2, 0, 0, Math.PI * 2);
  ctx.stroke();
}

function drawFinish(ctx: CanvasRenderingContext2D, object: ResolvedObject, theme: Theme, view: ViewTransform) {
  const x = view.toScreenX(object.x);
  const top = view.toScreenY(object.top);
  const height = object.height * view.scale;
  const width = Math.max(3, object.width * view.scale * 0.35);

  ctx.fillStyle = theme.accent;
  ctx.fillRect(x, top, width, height);

  const squares = 8;
  const squareHeight = height / squares;
  for (let i = 0; i < squares; i += 1) {
    ctx.fillStyle = i % 2 === 0 ? theme.accent : theme.skyBottom;
    ctx.fillRect(x + width, top + i * squareHeight, width * 2.4, squareHeight);
  }
}

export function drawObject(
  ctx: CanvasRenderingContext2D,
  object: ResolvedObject,
  theme: Theme,
  view: ViewTransform,
  time = 0,
): void {
  switch (object.category) {
    case "solid":
      drawSolid(ctx, object, theme, view);
      break;
    case "hazard":
      drawHazard(ctx, object, theme, view);
      break;
    case "pad":
      drawPad(ctx, object, view);
      break;
    case "orb":
      drawOrb(ctx, object, view, time);
      break;
    case "portal":
      drawPortal(ctx, object, view, time);
      break;
    case "goal":
      drawFinish(ctx, object, theme, view);
      break;
  }
}
