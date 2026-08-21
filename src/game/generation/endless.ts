import type { GenerateLevelOptions, LevelSection } from "@/game/generation/levelGenerator";
import { THEME_IDS, type ThemeId } from "@/game/render/themes";

/** Stage length in units. Short enough to generate between attempts. */
const STAGE_LENGTH = 230;

const SECTION_PLANS: LevelSection[][] = [
  [{ mode: "cube", weight: 1 }],
  [{ mode: "cube", weight: 1 }],
  [
    { mode: "cube", weight: 1 },
    { mode: "ship", weight: 1 },
    { mode: "cube", weight: 0.8 },
  ],
  [
    { mode: "cube", weight: 1 },
    { mode: "ball", weight: 1 },
    { mode: "cube", weight: 0.8 },
  ],
  [
    { mode: "cube", weight: 0.8 },
    { mode: "ship", weight: 1, flipGravity: true },
    { mode: "cube", weight: 0.8 },
  ],
  [
    { mode: "cube", weight: 0.8 },
    { mode: "ship", weight: 1 },
    { mode: "ball", weight: 1 },
    { mode: "cube", weight: 0.8 },
  ],
];

function sectionsFor(stage: number): LevelSection[] {
  // Early stages stay in cube; later ones sample the full set of plans.
  const pool = stage < 2 ? SECTION_PLANS.slice(0, 2) : SECTION_PLANS;
  return pool[stage % pool.length] as LevelSection[];
}

export interface EndlessStage {
  stage: number;
  seed: number;
  options: GenerateLevelOptions;
}

/**
 * Difficulty and speed climb with the stage, but every stage is still grown
 * against the solver — endless mode gets harder without ever handing the
 * player a section that cannot be cleared.
 */
export function createEndlessStage(runSeed: number, stage: number): EndlessStage {
  // Derive a per-stage seed so a run is fully reproducible from its run seed.
  const seed = (runSeed * 2654435761 + stage * 40503) >>> 0;
  const ceiling = Math.min(1, 0.3 + stage * 0.11);
  const theme = THEME_IDS[stage % THEME_IDS.length] as ThemeId;

  return {
    stage,
    seed,
    options: {
      id: `endless${stage}`,
      seed,
      name: `Endless · stage ${stage + 1}`,
      author: "Generator",
      targetLength: STAGE_LENGTH,
      baseSpeed: 8 + Math.min(1.8, stage * 0.22),
      theme,
      difficultyFrom: Math.max(0, ceiling - 0.22),
      difficultyTo: ceiling,
      sections: sectionsFor(stage),
    },
  };
}
