/**
 * Renders frames of a level to PNG using a headless canvas. Useful as a visual
 * smoke test for the renderer and for producing README screenshots without
 * having to run the app and take one by hand.
 *
 *   pnpm preview                       # a spread across level04
 *   pnpm preview level09 400 900 1400  # specific ticks
 */
import fs from "node:fs";
import path from "node:path";
import { createCanvas } from "@napi-rs/canvas";
import { GameEngine } from "@/game/core/GameEngine";
import { ReplayInput } from "@/game/input/AgentInput";
import { parseLevel } from "@/game/level/levelSchema";
import { CanvasRenderer } from "@/game/render/CanvasRenderer";
import { solveLevel } from "@/game/validation/reachabilitySolver";

const WIDTH = 1280;
const HEIGHT = 720;

const [levelId = "level04", ...tickArgs] = process.argv.slice(2);
const levelPath = path.resolve("src/data/builtinLevels", `${levelId}.json`);

if (!fs.existsSync(levelPath)) {
  console.error(`No such level: ${levelId}`);
  process.exit(1);
}

const level = parseLevel(JSON.parse(fs.readFileSync(levelPath, "utf8")));

// Drive the run with a real winning route so the frames show the player mid
// play rather than sitting dead at the first hazard.
const solution = solveLevel(level, { trackPath: true });
if (!solution.solvable || !solution.path) {
  console.error(`${levelId} is unsolvable; nothing to preview.`);
  process.exit(1);
}

const ticks =
  tickArgs.length > 0
    ? tickArgs.map((value) => Number.parseInt(value, 10)).filter(Number.isFinite)
    : [0, 1, 2, 3, 4].map((i) => Math.floor((solution.path!.length * (i + 0.5)) / 5));

const outputDir = path.resolve("previews");
fs.mkdirSync(outputDir, { recursive: true });

const canvas = createCanvas(WIDTH, HEIGHT);
const renderer = new CanvasRenderer(canvas as unknown as HTMLCanvasElement);
renderer.resize(WIDTH, HEIGHT, 1);

const engine = new GameEngine(level, new ReplayInput(solution.path));
const wanted = new Set(ticks);
const maxTick = Math.max(...ticks);

for (let tick = 0; tick <= maxTick; tick += 1) {
  if (wanted.has(tick)) {
    const snapshot = engine.getSnapshot();
    renderer.render(snapshot, 1 / 60);
    const file = path.join(outputDir, `${levelId}_t${String(tick).padStart(5, "0")}.png`);
    fs.writeFileSync(file, canvas.toBuffer("image/png"));
    console.log(
      `${path.relative(process.cwd(), file)}  ` +
        `${(snapshot.progress * 100).toFixed(1)}%  ${snapshot.player.mode}` +
        `${snapshot.player.gravity === -1 ? " (flipped)" : ""}`,
    );
  }

  if (engine.getStatus() !== "running") {
    break;
  }
  engine.step();
}
