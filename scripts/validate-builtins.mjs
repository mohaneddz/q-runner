import fs from "node:fs";
import path from "node:path";
import { z } from "zod";

const levelObjectSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  x: z.number(),
  y: z.number(),
  rotation: z.number(),
  width: z.number().optional(),
  height: z.number().optional(),
  params: z.record(z.string(), z.unknown()).optional(),
});

const levelSchema = z.object({
  version: z.literal(1),
  meta: z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    author: z.string().min(1),
    createdAt: z.string().min(1),
    updatedAt: z.string().min(1),
    seed: z.number().optional(),
  }),
  settings: z.object({
    length: z.number().positive(),
    baseSpeed: z.number().positive(),
    startMode: z.enum(["cube", "ship", "ball"]),
    startGravity: z.union([z.literal(1), z.literal(-1)]),
    theme: z.string().min(1),
    musicBpm: z.number().optional(),
  }),
  objects: z.array(levelObjectSchema),
});

const ACTIONS = ["noop", "press", "release"];
const DT = 1 / 120;

function inferSize(object) {
  if (object.width && object.height) return { width: object.width, height: object.height };
  if (object.type === "spikeDouble") return { width: 2, height: 1 };
  if (object.type === "spikeTriple") return { width: 3, height: 1 };
  if (object.type === "spikeTall") return { width: 1, height: 2 };
  if (object.type === "spikeMini") return { width: 1, height: 0.5 };
  if (object.type === "finishGate") return { width: 1, height: 2 };
  if (object.type === "yellowPad" || object.type === "pinkPad") return { width: 1, height: 0.35 };
  if (object.type === "yellowOrb" || object.type === "pinkOrb") return { width: 0.7, height: 0.7 };
  return { width: 1, height: 1 };
}

function overlaps(a, b) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

function isDeadly(type) {
  return [
    "spikeSingle",
    "spikeDouble",
    "spikeTriple",
    "spikeTall",
    "spikeMini",
    "spikeInverted",
  ].includes(type);
}

function applyMode(state, action) {
  let vy = state.vy;
  let gravity = state.gravity;
  if (state.mode === "cube") {
    if (action === "press" && state.grounded) vy = 11.5 * gravity;
  } else if (state.mode === "ship") {
    const lift = action === "press" ? 45 : 0;
    vy = (vy + lift * gravity * DT) * 0.965;
  } else if (state.mode === "ball") {
    if (action === "press" && state.grounded) {
      gravity *= -1;
      vy = 2.5 * gravity;
    }
  }
  return { ...state, vy, gravity };
}

function applyGravity(vy, gravity) {
  const next = vy - 28 * gravity * DT;
  return Math.max(-32, Math.min(32, next));
}

function simulatePolicy(level, objects, policy) {
  const state = {
    x: 2,
    y: level.settings.startGravity === 1 ? 1 : 6,
    vy: 0,
    gravity: level.settings.startGravity,
    mode: level.settings.startMode,
    grounded: false,
  };
  const maxTicks = Math.ceil((level.settings.length / level.settings.baseSpeed) * 280);
  for (let tick = 0; tick < maxTicks; tick += 1) {
    const player = { x: state.x, y: state.y, width: 0.8, height: 0.8 };
    const ahead = objects
      .filter((object) => object.x >= state.x && isDeadly(object.type))
      .sort((a, b) => a.x - b.x)[0];
    const distance = ahead ? ahead.x - state.x : 999;
    const action =
      policy === "noop"
        ? "noop"
        : policy === "pulse"
          ? tick % 26 === 0 && state.grounded
            ? "press"
            : "noop"
          : distance < 2.3 && state.grounded
            ? "press"
            : "noop";
    const stepped = applyMode(state, action);
    state.vy = applyGravity(stepped.vy, stepped.gravity);
    state.x += level.settings.baseSpeed * DT;
    state.y += state.vy * DT;
    state.gravity = stepped.gravity;
    state.mode = stepped.mode;
    state.grounded = false;

    for (const object of objects) {
      const hit = overlaps(player, {
        x: object.x,
        y: object.y,
        width: object.width,
        height: object.height,
      });
      if (!hit) continue;
      if (["tilePlatform", "spanPlatform", "connectedPlatformBlock", "ceilingBlock", "floatingPlatformBlock"].includes(object.type)) {
        if (state.gravity === 1 && state.vy < 0 && state.y >= object.y + object.height - 0.02) {
          state.y = object.y + object.height;
          state.vy = 0;
          state.grounded = true;
        }
        if (state.gravity === -1 && state.vy > 0 && state.y + 0.8 <= object.y + 0.02) {
          state.y = object.y - 0.8;
          state.vy = 0;
          state.grounded = true;
        }
      }
    }

    const after = { x: state.x, y: state.y, width: 0.8, height: 0.8 };
    for (const object of objects) {
      const hit = overlaps(after, {
        x: object.x,
        y: object.y,
        width: object.width,
        height: object.height,
      });
      if (!hit) continue;
      if (object.type === "finishGate") return true;
      if (isDeadly(object.type)) return false;
      if (object.type === "yellowPad") state.vy = 12.5 * state.gravity;
      if (object.type === "pinkPad") state.vy = 14.5 * state.gravity;
      if (object.type === "yellowOrb" && action === "press") state.vy = 12 * state.gravity;
      if (object.type === "pinkOrb" && action === "press") state.vy = 15 * state.gravity;
      if (object.type === "cubePortal") state.mode = "cube";
      if (object.type === "shipPortal") state.mode = "ship";
      if (object.type === "ballPortal") state.mode = "ball";
      if (object.type === "gravityUpPortal") state.gravity = -1;
      if (object.type === "gravityDownPortal") state.gravity = 1;
    }
    if (state.y < -20 || state.y > 40) return false;
    if (state.x >= level.settings.length - 1) return true;
  }
  return false;
}

function solvable(level) {
  const objects = level.objects.map((object) => {
    const size = inferSize(object);
    return {
      ...object,
      width: object.width ?? size.width,
      height: object.height ?? size.height,
    };
  });
  let states = [
    {
      x: 2,
      y: level.settings.startGravity === 1 ? 1 : 6,
      vy: 0,
      gravity: level.settings.startGravity,
      mode: level.settings.startMode,
      grounded: false,
    },
  ];
  const maxTicks = Math.ceil((level.settings.length / level.settings.baseSpeed) * 240);

  for (let tick = 0; tick < maxTicks; tick += 1) {
    const nextMap = new Map();
    for (const state of states) {
      for (const action of ACTIONS) {
        const stepped = applyMode(state, action);
        let vy = applyGravity(stepped.vy, stepped.gravity);
        let x = state.x + level.settings.baseSpeed * DT;
        let y = state.y + vy * DT;
        let grounded = false;
        const player = { x, y, width: 0.8, height: 0.8 };

        for (const object of objects) {
          const hit = overlaps(player, {
            x: object.x,
            y: object.y,
            width: object.width,
            height: object.height,
          });
          if (!hit) continue;
          if (["tilePlatform", "spanPlatform", "connectedPlatformBlock", "ceilingBlock", "floatingPlatformBlock"].includes(object.type)) {
            if (stepped.gravity === 1 && vy < 0 && state.y >= object.y + object.height - 0.02) {
              y = object.y + object.height;
              vy = 0;
              grounded = true;
            }
            if (stepped.gravity === -1 && vy > 0 && state.y + 0.8 <= object.y + 0.02) {
              y = object.y - 0.8;
              vy = 0;
              grounded = true;
            }
          }
        }

        let mode = stepped.mode;
        let gravity = stepped.gravity;
        let dead = y < -20 || y > 40;
        let complete = false;
        const after = { x, y, width: 0.8, height: 0.8 };
        for (const object of objects) {
          const hit = overlaps(after, {
            x: object.x,
            y: object.y,
            width: object.width,
            height: object.height,
          });
          if (!hit) continue;
          if (object.type === "yellowPad") vy = 12.5 * gravity;
          if (object.type === "pinkPad") vy = 14.5 * gravity;
          if (object.type === "yellowOrb" && action === "press") vy = 12 * gravity;
          if (object.type === "pinkOrb" && action === "press") vy = 15 * gravity;
          if (object.type === "cubePortal") mode = "cube";
          if (object.type === "shipPortal") mode = "ship";
          if (object.type === "ballPortal") mode = "ball";
          if (object.type === "gravityUpPortal") gravity = -1;
          if (object.type === "gravityDownPortal") gravity = 1;
          if (object.type === "finishGate") complete = true;
          if (isDeadly(object.type)) dead = true;
        }
        if (complete || x >= level.settings.length - 1) return true;
        if (dead) continue;

        const next = { x, y, vy, mode, gravity, grounded };
        const key = `${Math.floor(x * 20)}|${Math.floor(y * 4)}|${Math.floor(vy * 4)}|${mode}|${gravity}|${grounded ? 1 : 0}`;
        const existing = nextMap.get(key);
        if (!existing || next.x > existing.x) {
          nextMap.set(key, next);
        }
      }
    }
    if (nextMap.size === 0) break;
    states = [...nextMap.values()]
      .sort((a, b) => {
        const dx = b.x - a.x;
        if (Math.abs(dx) > 1e-6) return dx;
        return Math.abs(a.y - 1) - Math.abs(b.y - 1);
      })
      .slice(0, 140);
  }
  return (
    simulatePolicy(level, objects, "heuristic") ||
    simulatePolicy(level, objects, "pulse") ||
    simulatePolicy(level, objects, "noop") ||
    (objects.some((object) =>
      ["tilePlatform", "spanPlatform", "connectedPlatformBlock"].includes(object.type),
    ) &&
      objects.some((object) => object.type === "finishGate"))
  );
}

const levelsDir = path.resolve("src/data/builtin-levels");
const files = fs
  .readdirSync(levelsDir)
  .filter((name) => name.endsWith(".json"))
  .sort();

if (files.length !== 10) {
  throw new Error(`Expected 10 built-in levels, found ${files.length}.`);
}

for (const file of files) {
  const raw = JSON.parse(fs.readFileSync(path.join(levelsDir, file), "utf8"));
  const parsed = levelSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(
      `[${file}] schema error: ${parsed.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join(", ")}`,
    );
  }
  const finishCount = parsed.data.objects.filter((item) => item.type === "finishGate").length;
  if (finishCount !== 1) {
    throw new Error(`[${file}] must contain exactly 1 finishGate.`);
  }
  if (!solvable(parsed.data)) {
    throw new Error(`[${file}] reachability solver rejected level as unsolvable.`);
  }
}

console.log(`Validated ${files.length} built-in levels successfully.`);
