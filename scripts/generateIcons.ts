/**
 * Draws the app icons and the social card from the same shapes and palette the
 * game renders with, so the tab icon and the OG card cannot drift away from
 * what the game actually looks like.
 *
 *   pnpm generate:icons
 */
import fs from "node:fs";
import path from "node:path";
import { createCanvas, type SKRSContext2D } from "@napi-rs/canvas";
import { THEMES } from "@/game/render/themes";

const theme = THEMES.neon;
const appDir = path.resolve("src/app");

function backdrop(ctx: SKRSContext2D, width: number, height: number) {
  const sky = ctx.createLinearGradient(0, 0, width, height);
  sky.addColorStop(0, "#101c3a");
  sky.addColorStop(1, "#05070f");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = "rgba(32, 241, 255, 0.13)";
  ctx.lineWidth = Math.max(1, width / 400);
  const step = width / 12;
  ctx.beginPath();
  for (let x = step; x < width; x += step) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
  }
  for (let y = step; y < height; y += step) {
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
  }
  ctx.stroke();
}

/** The player cube, tilted the way it looks mid-jump. */
function cube(ctx: SKRSContext2D, centreX: number, centreY: number, size: number) {
  ctx.save();
  ctx.translate(centreX, centreY);
  ctx.rotate(-0.22);

  ctx.shadowColor = theme.playerEdge;
  ctx.shadowBlur = size * 0.45;
  ctx.fillStyle = theme.player;
  ctx.beginPath();
  ctx.roundRect(-size / 2, -size / 2, size, size, size * 0.17);
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.strokeStyle = theme.playerEdge;
  ctx.lineWidth = size * 0.07;
  ctx.beginPath();
  ctx.roundRect(-size / 2, -size / 2, size, size, size * 0.17);
  ctx.stroke();

  ctx.fillStyle = theme.playerEdge;
  ctx.fillRect(-size * 0.17, -size * 0.17, size * 0.34, size * 0.34);
  ctx.restore();
}

function spike(ctx: SKRSContext2D, x: number, baseY: number, width: number, height: number) {
  ctx.fillStyle = theme.hazard;
  ctx.beginPath();
  ctx.moveTo(x, baseY);
  ctx.lineTo(x + width, baseY);
  ctx.lineTo(x + width / 2, baseY - height);
  ctx.closePath();
  ctx.fill();
}

function drawIcon(size: number): Buffer {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext("2d");

  backdrop(ctx, size, size);

  const floorY = size * 0.78;
  ctx.fillStyle = theme.solidFill;
  ctx.fillRect(0, floorY, size, size - floorY);
  ctx.fillStyle = theme.solidEdge;
  ctx.fillRect(0, floorY, size, Math.max(2, size * 0.03));

  spike(ctx, size * 0.62, floorY, size * 0.17, size * 0.19);
  cube(ctx, size * 0.4, size * 0.48, size * 0.34);

  return canvas.toBuffer("image/png");
}

function drawSocialCard(): Buffer {
  const width = 1200;
  const height = 630;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  backdrop(ctx, width, height);

  const floorY = height * 0.76;
  ctx.fillStyle = theme.solidFill;
  ctx.fillRect(0, floorY, width, height - floorY);
  ctx.fillStyle = theme.solidEdge;
  ctx.fillRect(0, floorY, width, 5);

  // Kept to the right of the text block so the artwork never covers a word.
  spike(ctx, 900, floorY, 52, 58);
  spike(ctx, 972, floorY, 52, 58);
  spike(ctx, 1094, floorY, 52, 58);
  cube(ctx, 1000, floorY - 168, 96);

  ctx.textBaseline = "alphabetic";
  ctx.font = "800 92px 'Segoe UI', 'Helvetica Neue', Arial, sans-serif";
  ctx.fillStyle = theme.playerEdge;
  ctx.fillText("Q", 84, 220);
  ctx.fillStyle = theme.player;
  ctx.fillText("-Runner", 84 + ctx.measureText("Q").width, 220);

  ctx.font = "500 34px 'Segoe UI', 'Helvetica Neue', Arial, sans-serif";
  ctx.fillStyle = theme.solidEdge;
  ctx.fillText("A precision auto-runner with a solver in the build", 88, 285);

  ctx.font = "600 26px 'Segoe UI', 'Helvetica Neue', Arial, sans-serif";
  ctx.fillStyle = "rgba(232, 239, 255, 0.62)";
  ctx.fillText("cube · ship · ball  ·  level editor  ·  endless  ·  Q-learning", 88, 340);

  return canvas.toBuffer("image/png");
}

/**
 * Minimal ICO container around a PNG. The format allows PNG payloads directly,
 * so this is a 22-byte header rather than a bitmap encoder.
 */
function pngToIco(png: Buffer, size: number): Buffer {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(1, 4);

  const entry = Buffer.alloc(16);
  entry.writeUInt8(size >= 256 ? 0 : size, 0);
  entry.writeUInt8(size >= 256 ? 0 : size, 1);
  entry.writeUInt8(0, 2);
  entry.writeUInt8(0, 3);
  entry.writeUInt16LE(1, 4);
  entry.writeUInt16LE(32, 6);
  entry.writeUInt32LE(png.length, 8);
  entry.writeUInt32LE(header.length + entry.length, 12);

  return Buffer.concat([header, entry, png]);
}

const outputs: [string, Buffer][] = [
  [path.join(appDir, "icon.png"), drawIcon(512)],
  [path.join(appDir, "apple-icon.png"), drawIcon(180)],
  [path.join(appDir, "favicon.ico"), pngToIco(drawIcon(32), 32)],
  [path.join(appDir, "opengraph-image.png"), drawSocialCard()],
  [path.resolve("public/icons/icon192.png"), drawIcon(192)],
  [path.resolve("public/icons/icon512.png"), drawIcon(512)],
];

for (const [file, buffer] of outputs) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, buffer);
  console.log(`${path.relative(process.cwd(), file)}  ${(buffer.length / 1024).toFixed(1)}KB`);
}
