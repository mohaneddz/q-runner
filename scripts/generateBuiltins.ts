/**
 * Authors the ten built-in levels. Every level is grown chunk-by-chunk against
 * the reachability solver, so what lands in `src/data/builtinLevels` is proven
 * clearable before it is ever written to disk.
 *
 * Run with `pnpm generate:levels`. Output is deterministic for a given seed.
 */
import fs from "node:fs";
import path from "node:path";
import { generateLevel, type LevelSection } from "@/game/generation/levelGenerator";
import { solveLevel } from "@/game/validation/reachabilitySolver";
import type { ThemeId } from "@/game/render/themes";

interface LevelPlan {
  id: string;
  name: string;
  seed: number;
  targetLength: number;
  baseSpeed: number;
  theme: ThemeId;
  difficultyFrom: number;
  difficultyTo: number;
  sections: LevelSection[];
}

const cube = (weight: number, flipGravity = false): LevelSection => ({
  mode: "cube",
  weight,
  flipGravity,
});
const ship = (weight: number, flipGravity = false): LevelSection => ({
  mode: "ship",
  weight,
  flipGravity,
});
const ball = (weight: number, flipGravity = false): LevelSection => ({
  mode: "ball",
  weight,
  flipGravity,
});

/**
 * Difficulty ramps across the campaign and each level's mode structure is laid
 * out explicitly, so the ship level really is a ship level. Seeds are fixed:
 * regenerating produces byte-identical files unless the chunk library changes.
 */
const PLANS: LevelPlan[] = [
  {
    id: "level01", name: "First Light", seed: 1017,
    targetLength: 120, baseSpeed: 8, theme: "neon",
    difficultyFrom: 0, difficultyTo: 0.18,
    sections: [cube(1)],
  },
  {
    id: "level02", name: "Static Drift", seed: 2281,
    targetLength: 135, baseSpeed: 8, theme: "neon",
    difficultyFrom: 0.14, difficultyTo: 0.34,
    sections: [cube(1)],
  },
  {
    id: "level03", name: "Overpass", seed: 3359,
    targetLength: 150, baseSpeed: 8.2, theme: "circuit",
    difficultyFrom: 0.26, difficultyTo: 0.46,
    sections: [cube(1)],
  },
  {
    id: "level04", name: "Ion Wake", seed: 4483,
    targetLength: 165, baseSpeed: 8.2, theme: "sunset",
    difficultyFrom: 0.32, difficultyTo: 0.52,
    sections: [cube(0.8), ship(1.4), cube(0.8)],
  },
  {
    id: "level05", name: "Crosswire", seed: 5573,
    targetLength: 180, baseSpeed: 8.4, theme: "circuit",
    difficultyFrom: 0.4, difficultyTo: 0.6,
    sections: [cube(1), ship(1), cube(1), ship(0.8), cube(0.6)],
  },
  {
    id: "level06", name: "Nightfall", seed: 6661,
    targetLength: 185, baseSpeed: 8.6, theme: "void",
    difficultyFrom: 0.46, difficultyTo: 0.66,
    sections: [cube(1), ball(1.2), cube(1)],
  },
  {
    id: "level07", name: "Rollcage", seed: 7757,
    targetLength: 195, baseSpeed: 8.6, theme: "void",
    difficultyFrom: 0.54, difficultyTo: 0.72,
    sections: [cube(0.7), ball(1.2), ship(1), ball(1), cube(0.6)],
  },
  {
    id: "level08", name: "Inversion", seed: 8849,
    targetLength: 195, baseSpeed: 8.8, theme: "ember",
    difficultyFrom: 0.6, difficultyTo: 0.8,
    sections: [cube(1), ship(1, true), ship(1, true), cube(1)],
  },
  {
    id: "level09", name: "Redline", seed: 9931,
    targetLength: 210, baseSpeed: 9.2, theme: "ember",
    difficultyFrom: 0.7, difficultyTo: 0.9,
    sections: [cube(1), ship(1), ball(1), ship(0.8, true), cube(1)],
  },
  {
    id: "level10", name: "Terminal Velocity", seed: 10259,
    targetLength: 230, baseSpeed: 9.5, theme: "void",
    difficultyFrom: 0.8, difficultyTo: 1,
    sections: [cube(1), ship(1), cube(0.8), ball(1), ship(1, true), cube(1)],
  },
];

/**
 * Fixed so regenerating writes byte-identical files. A wall-clock timestamp
 * would put an unrelated diff in every level on every run.
 */
const AUTHORED_AT = "2026-08-21T00:00:00.000Z";

const outputDir = path.resolve("src/data/builtinLevels");
fs.mkdirSync(outputDir, { recursive: true });

const PORTAL_MODE = {
  cubePortal: "cube",
  shipPortal: "ship",
  ballPortal: "ball",
} as const;

interface ManifestEntry {
  id: string;
  name: string;
  author: string;
  theme: ThemeId;
  length: number;
  baseSpeed: number;
  objectCount: number;
  /** 1-10, the campaign ordering. */
  tier: number;
  modes: string[];
  hasGravityFlips: boolean;
}

const manifest: ManifestEntry[] = [];
let failures = 0;

for (const plan of PLANS) {
  const startedAt = Date.now();
  const level = generateLevel({
    id: plan.id,
    seed: plan.seed,
    name: plan.name,
    targetLength: plan.targetLength,
    baseSpeed: plan.baseSpeed,
    theme: plan.theme,
    difficultyFrom: plan.difficultyFrom,
    difficultyTo: plan.difficultyTo,
    sections: plan.sections,
    timestamp: AUTHORED_AT,
  });

  // Levels are grown against an incremental beam; re-solve the finished level
  // end to end so the file on disk is verified as a whole, not just in pieces.
  const result = solveLevel(level);
  const elapsed = Date.now() - startedAt;

  if (!result.solvable) {
    failures += 1;
    console.error(
      `✗ ${plan.id} (${plan.name}) unsolvable — died at x=${result.reachedX.toFixed(1)} of ${level.settings.length}`,
    );
    continue;
  }

  fs.writeFileSync(
    path.join(outputDir, `${plan.id}.json`),
    `${JSON.stringify(level, null, 2)}\n`,
    "utf8",
  );

  const modes = new Set<string>([level.settings.startMode]);
  let hasGravityFlips = false;
  for (const object of level.objects) {
    if (object.type in PORTAL_MODE) {
      modes.add(PORTAL_MODE[object.type as keyof typeof PORTAL_MODE]);
    }
    if (object.type === "gravityUpPortal" || object.type === "gravityDownPortal") {
      hasGravityFlips = true;
    }
  }

  manifest.push({
    id: level.meta.id,
    name: level.meta.name,
    author: level.meta.author,
    theme: level.settings.theme,
    length: level.settings.length,
    baseSpeed: level.settings.baseSpeed,
    objectCount: level.objects.length,
    tier: manifest.length + 1,
    modes: ["cube", "ship", "ball"].filter((mode) => modes.has(mode)),
    hasGravityFlips,
  });

  console.log(
    `✓ ${plan.id} ${plan.name.padEnd(18)} ${String(level.objects.length).padStart(4)} objects  ` +
      `${level.settings.length.toFixed(0).padStart(4)}u  ${(elapsed / 1000).toFixed(1)}s`,
  );
}

if (failures > 0) {
  console.error(`\n${failures} level(s) failed to generate.`);
  process.exit(1);
}

// A small index so the level picker does not have to pull every level body.
fs.writeFileSync(
  path.join(outputDir, "manifest.json"),
  `${JSON.stringify(manifest, null, 2)}\n`,
  "utf8",
);

console.log(`\nWrote ${PLANS.length} levels to ${path.relative(process.cwd(), outputDir)}`);
