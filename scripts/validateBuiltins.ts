/**
 * Build gate for the shipped levels. Runs the same simulation the game runs,
 * so "validated" means a human can actually clear it — not just that the JSON
 * parses. `pnpm build` runs this first and fails the build on any rejection.
 */
import fs from "node:fs";
import path from "node:path";
import { formatLevelIssues, safeParseLevel } from "@/game/level/levelSchema";
import { solveLevel } from "@/game/validation/reachabilitySolver";

const EXPECTED_LEVEL_COUNT = 10;

const levelsDir = path.resolve("src/data/builtinLevels");

if (!fs.existsSync(levelsDir)) {
  console.error(`Missing ${path.relative(process.cwd(), levelsDir)}. Run \`pnpm generate:levels\`.`);
  process.exit(1);
}

const MANIFEST_FILE = "manifest.json";

const files = fs
  .readdirSync(levelsDir)
  .filter((name) => name.endsWith(".json") && name !== MANIFEST_FILE)
  .sort();

const errors: string[] = [];

if (files.length !== EXPECTED_LEVEL_COUNT) {
  errors.push(`Expected ${EXPECTED_LEVEL_COUNT} built-in levels, found ${files.length}.`);
}

const seenIds = new Set<string>();

for (const file of files) {
  const raw: unknown = JSON.parse(fs.readFileSync(path.join(levelsDir, file), "utf8"));
  const parsed = safeParseLevel(raw);

  if (!parsed.success) {
    errors.push(`[${file}] schema error: ${formatLevelIssues(parsed.error)}`);
    continue;
  }

  const level = parsed.data;
  const expectedId = path.basename(file, ".json");

  if (level.meta.id !== expectedId) {
    errors.push(`[${file}] meta.id is "${level.meta.id}" but the file is named "${expectedId}".`);
  }
  if (seenIds.has(level.meta.id)) {
    errors.push(`[${file}] duplicate level id "${level.meta.id}".`);
  }
  seenIds.add(level.meta.id);

  const finishGates = level.objects.filter((object) => object.type === "finishGate").length;
  if (finishGates !== 1) {
    errors.push(`[${file}] must contain exactly 1 finishGate, found ${finishGates}.`);
  }

  const result = solveLevel(level);
  if (!result.solvable) {
    errors.push(
      `[${file}] unsolvable — the solver died at x=${result.reachedX.toFixed(1)} of ` +
        `${level.settings.length} after ${result.ticksSurvived} ticks.`,
    );
    continue;
  }

  console.log(
    `✓ ${file.padEnd(14)} ${level.meta.name.padEnd(18)} ` +
      `${String(level.objects.length).padStart(4)} objects  ` +
      `${level.settings.length.toFixed(0).padStart(4)}u  solved in ${result.ticksSurvived} ticks`,
  );
}

const manifestPath = path.join(levelsDir, MANIFEST_FILE);
if (!fs.existsSync(manifestPath)) {
  errors.push(`Missing ${MANIFEST_FILE}. Run \`pnpm generate:levels\`.`);
} else {
  const manifest: unknown = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  if (!Array.isArray(manifest) || manifest.length !== files.length) {
    errors.push(
      `${MANIFEST_FILE} lists ${Array.isArray(manifest) ? manifest.length : "?"} levels but ` +
        `${files.length} level files exist.`,
    );
  }
}

if (errors.length > 0) {
  console.error(`\n${errors.length} problem(s):`);
  for (const error of errors) {
    console.error(`  ✗ ${error}`);
  }
  process.exit(1);
}

console.log(`\nValidated ${files.length} built-in levels successfully.`);
