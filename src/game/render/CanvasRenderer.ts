import { CANVAS_HEIGHT, CANVAS_WIDTH, GROUND_Y } from "@/game/core/constants";
import type { Snapshot } from "@/game/core/types";

export class CanvasRenderer {
  private ctx: CanvasRenderingContext2D;

  constructor(private readonly canvas: HTMLCanvasElement) {
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("2D context unavailable");
    }
    this.ctx = context;
    this.canvas.width = CANVAS_WIDTH;
    this.canvas.height = CANVAS_HEIGHT;
  }

  render(snapshot: Snapshot): void {
    const ctx = this.ctx;
    const cameraX = snapshot.cameraX;

    const sky = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
    sky.addColorStop(0, "#0b1328");
    sky.addColorStop(1, "#070b16");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    ctx.strokeStyle = "rgba(32, 241, 255, 0.1)";
    ctx.lineWidth = 1;
    for (let x = -((cameraX % 32) + 32); x < CANVAS_WIDTH; x += 32) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, CANVAS_HEIGHT);
      ctx.stroke();
    }

    for (const object of snapshot.objects) {
      const screenX = object.x - cameraX;
      if (screenX + object.width < -64 || screenX > CANVAS_WIDTH + 64) {
        continue;
      }

      if (object.type === "platform") {
        ctx.fillStyle = "#16d3ff";
        ctx.globalAlpha = 0.9;
        ctx.fillRect(screenX, object.y, object.width, object.height);
        ctx.globalAlpha = 1;
      } else {
        ctx.fillStyle = "#ff4dbf";
        ctx.beginPath();
        ctx.moveTo(screenX, object.y + object.height);
        ctx.lineTo(screenX + object.width, object.y + object.height);
        ctx.lineTo(screenX + object.width / 2, object.y);
        ctx.closePath();
        ctx.fill();
      }
    }

    const finishX = snapshot.level.length - 24 - cameraX;
    ctx.fillStyle = "#81ff6f";
    ctx.fillRect(finishX, 0, 6, GROUND_Y + 100);

    const player = snapshot.player;
    const px = player.x - cameraX;
    const py = player.y;

    ctx.save();
    ctx.translate(px + player.width / 2, py + player.height / 2);
    ctx.rotate(player.rotation);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(-player.width / 2, -player.height / 2, player.width, player.height);
    ctx.strokeStyle = "#20f1ff";
    ctx.lineWidth = 2;
    ctx.strokeRect(-player.width / 2, -player.height / 2, player.width, player.height);
    ctx.restore();

    ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
    ctx.fillRect(0, GROUND_Y + 100, CANVAS_WIDTH, CANVAS_HEIGHT - (GROUND_Y + 100));
  }
}
