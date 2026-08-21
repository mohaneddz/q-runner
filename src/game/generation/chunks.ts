import type { GameMode, Gravity, LevelObjectType } from "@/game/level/objectCatalog";
import type { Random } from "@/utils/random";

/** A level object before it is assigned an id and shifted into world space. */
export interface DraftObject {
  type: LevelObjectType;
  x: number;
  y: number;
  width?: number;
  height?: number;
  rotation?: number;
}

export interface ChunkRequest {
  rng: Random;
  /** 0 = opening bars, 1 = hardest section of the hardest level. */
  difficulty: number;
  mode: GameMode;
  gravity: Gravity;
}

export interface Chunk {
  objects: DraftObject[];
  width: number;
  mode: GameMode;
  gravity: Gravity;
}

export interface ChunkBuilder {
  id: string;
  /** Entry modes this chunk can be appended after. */
  modes: GameMode[];
  minDifficulty: number;
  maxDifficulty: number;
  /** Relative likelihood of being picked when eligible. */
  weight: number;
  build(request: ChunkRequest): Chunk;
}

/** Walkable surface height. Floors occupy y = 0..1 throughout. */
export const FLOOR_TOP = 1;
const FLOOR_THICKNESS = 1;
/** Floor of a pit, low enough that falling in is unrecoverable. */
const PIT_FLOOR_Y = -3;

function floor(x: number, width: number, y = FLOOR_TOP - FLOOR_THICKNESS): DraftObject {
  return { type: "spanPlatform", x, y, width, height: FLOOR_THICKNESS };
}

function ceiling(x: number, width: number, y: number): DraftObject {
  return { type: "ceilingBlock", x, y, width, height: FLOOR_THICKNESS };
}

function block(x: number, y: number, width: number, height: number): DraftObject {
  return { type: "connectedPlatformBlock", x, y, width, height };
}

function spike(x: number, y = FLOOR_TOP, type: LevelObjectType = "spikeSingle"): DraftObject {
  return { type, x, y };
}

/** A ceiling spike hangs from `y`, occupying the unit below it. */
function ceilingSpike(x: number, y: number): DraftObject {
  return { type: "spikeInverted", x, y: y - 1, rotation: 180 };
}

/** Spike bed at the bottom of a pit so falling in reads as a loss immediately. */
function pitBed(x: number, width: number): DraftObject[] {
  const objects: DraftObject[] = [floor(x, width, PIT_FLOOR_Y)];
  for (let offset = 0; offset < width; offset += 1) {
    objects.push(spike(x + offset, PIT_FLOOR_Y + FLOOR_THICKNESS));
  }
  return objects;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

// --- Cube chunks -----------------------------------------------------------

const cubeFlat: ChunkBuilder = {
  id: "cubeFlat",
  modes: ["cube"],
  minDifficulty: 0,
  maxDifficulty: 0.5,
  weight: 0.5,
  build({ rng, mode, gravity }) {
    const width = rng.int(6, 9);
    return { objects: [floor(0, width)], width, mode, gravity };
  },
};

const cubeSpikes: ChunkBuilder = {
  id: "cubeSpikes",
  modes: ["cube"],
  minDifficulty: 0,
  maxDifficulty: 1,
  weight: 3,
  build({ rng, difficulty, mode, gravity }) {
    const clusters = rng.int(2, difficulty > 0.45 ? 4 : 3);
    const spacing = Math.round(lerp(8, 5.5, difficulty));
    const width = 3 + clusters * spacing;
    const objects: DraftObject[] = [floor(0, width)];

    for (let i = 0; i < clusters; i += 1) {
      const type = rng.weighted<LevelObjectType>([
        { value: "spikeSingle", weight: 3 },
        { value: "spikeDouble", weight: difficulty > 0.3 ? 2 : 0.5 },
        { value: "spikeTriple", weight: difficulty > 0.6 ? 1.2 : 0 },
        { value: "spikeMini", weight: 1 },
      ]);
      objects.push(spike(3 + i * spacing, FLOOR_TOP, type));
    }

    return { objects, width, mode, gravity };
  },
};

const cubeTallSpike: ChunkBuilder = {
  id: "cubeTallSpike",
  modes: ["cube"],
  minDifficulty: 0.45,
  maxDifficulty: 1,
  weight: 1.4,
  build({ rng, mode, gravity }) {
    const width = rng.int(12, 15);
    const objects: DraftObject[] = [floor(0, width)];
    objects.push(spike(6, FLOOR_TOP, "spikeTall"));
    if (rng.chance(0.5)) {
      objects.push(spike(width - 4, FLOOR_TOP, "spikeSingle"));
    }
    return { objects, width, mode, gravity };
  },
};

const cubePit: ChunkBuilder = {
  id: "cubePit",
  modes: ["cube"],
  minDifficulty: 0.15,
  maxDifficulty: 1,
  weight: 2.4,
  build({ rng, difficulty, mode, gravity }) {
    const gap = Math.round(lerp(3, 5, difficulty * rng.range(0.6, 1)));
    const lead = rng.int(5, 8);
    const tail = rng.int(6, 9);
    const width = lead + gap + tail;

    const objects: DraftObject[] = [
      floor(0, lead),
      ...pitBed(lead, gap),
      floor(lead + gap, tail),
    ];

    return { objects, width, mode, gravity };
  },
};

const cubeStairs: ChunkBuilder = {
  id: "cubeStairs",
  modes: ["cube"],
  minDifficulty: 0.3,
  maxDifficulty: 1,
  weight: 1.6,
  build({ rng, mode, gravity }) {
    const steps = rng.int(2, 3);
    const run = 7;
    const width = 4 + steps * run * 2;
    const objects: DraftObject[] = [floor(0, width)];

    for (let i = 1; i <= steps; i += 1) {
      objects.push(block(4 + (i - 1) * run, FLOOR_TOP, run, i));
    }
    for (let i = steps - 1; i >= 1; i -= 1) {
      const index = steps - i;
      objects.push(block(4 + (steps + index - 1) * run, FLOOR_TOP, run, i));
    }

    return { objects, width, mode, gravity };
  },
};

const cubePlatforms: ChunkBuilder = {
  id: "cubePlatforms",
  modes: ["cube"],
  minDifficulty: 0.35,
  maxDifficulty: 1,
  weight: 2,
  build({ rng, difficulty, mode, gravity }) {
    const hops = rng.int(2, 3);
    const spacing = Math.round(lerp(8, 6.5, difficulty));
    const lead = 5;
    const width = lead + hops * spacing + 8;

    const objects: DraftObject[] = [floor(0, lead), ...pitBed(lead, width - lead - 8)];

    for (let i = 0; i < hops; i += 1) {
      const x = lead + 1 + i * spacing;
      const height = FLOOR_TOP + rng.int(0, 2);
      objects.push({
        type: "floatingPlatformBlock",
        x,
        y: height,
        width: rng.int(3, 4),
        height: 1,
      });
    }

    objects.push(floor(width - 8, 8));
    return { objects, width, mode, gravity };
  },
};

const cubePad: ChunkBuilder = {
  id: "cubePad",
  modes: ["cube"],
  minDifficulty: 0.4,
  maxDifficulty: 1,
  weight: 1.6,
  build({ rng, mode, gravity }) {
    const pink = rng.chance(0.45);
    const hazardWidth = pink ? rng.int(7, 9) : rng.int(5, 7);
    const lead = 6;
    const tail = 9;
    const width = lead + hazardWidth + tail;

    const objects: DraftObject[] = [floor(0, width)];
    objects.push({ type: pink ? "pinkPad" : "yellowPad", x: lead - 2, y: FLOOR_TOP });
    for (let offset = 0; offset < hazardWidth; offset += 1) {
      objects.push(spike(lead + offset, FLOOR_TOP));
    }

    return { objects, width, mode, gravity };
  },
};

const cubeOrb: ChunkBuilder = {
  id: "cubeOrb",
  modes: ["cube"],
  minDifficulty: 0.5,
  maxDifficulty: 1,
  weight: 1.8,
  build({ rng, mode, gravity }) {
    const pink = rng.chance(0.4);
    const gap = pink ? rng.int(9, 11) : rng.int(8, 10);
    const lead = 6;
    const tail = 8;
    const width = lead + gap + tail;

    const objects: DraftObject[] = [
      floor(0, lead),
      ...pitBed(lead, gap),
      floor(lead + gap, tail),
      {
        type: pink ? "pinkOrb" : "yellowOrb",
        x: lead + gap / 2 - 0.35,
        y: FLOOR_TOP + 2.1,
      },
    ];

    return { objects, width, mode, gravity };
  },
};

// --- Ship chunks -----------------------------------------------------------

/** Builds a floor/ceiling channel that drifts between two heights. */
function corridor(
  width: number,
  startBase: number,
  endBase: number,
  clearance: number,
): DraftObject[] {
  const objects: DraftObject[] = [];
  for (let x = 0; x < width; x += 1) {
    const base = Math.round(lerp(startBase, endBase, width <= 1 ? 0 : x / (width - 1)) * 2) / 2;
    objects.push(block(x, base - FLOOR_THICKNESS, 1, FLOOR_THICKNESS));
    objects.push(ceiling(x, 1, base + clearance));
  }
  return objects;
}

const shipCorridor: ChunkBuilder = {
  id: "shipCorridor",
  modes: ["ship"],
  minDifficulty: 0,
  maxDifficulty: 1,
  weight: 3,
  build({ rng, difficulty, mode, gravity }) {
    const width = rng.int(14, 20);
    const clearance = Math.round(lerp(4.5, 3.5, difficulty) * 2) / 2;
    const startBase = FLOOR_TOP;
    const endBase = FLOOR_TOP + rng.int(-1, 2);
    return { objects: corridor(width, startBase, endBase, clearance), width, mode, gravity };
  },
};

const shipSpikes: ChunkBuilder = {
  id: "shipSpikes",
  modes: ["ship"],
  minDifficulty: 0.35,
  maxDifficulty: 1,
  weight: 2.2,
  build({ rng, difficulty, mode, gravity }) {
    const width = rng.int(16, 22);
    const clearance = Math.round(lerp(5, 4, difficulty) * 2) / 2;
    const base = FLOOR_TOP;
    const objects = corridor(width, base, base, clearance);
    const spacing = Math.round(lerp(7, 5, difficulty));

    for (let x = 5; x < width - 3; x += spacing) {
      if (rng.chance(0.5)) {
        objects.push(spike(x, base));
      } else {
        objects.push(ceilingSpike(x, base + clearance));
      }
    }

    return { objects, width, mode, gravity };
  },
};

// --- Ball chunks -----------------------------------------------------------

const ballCorridor: ChunkBuilder = {
  id: "ballCorridor",
  modes: ["ball"],
  minDifficulty: 0,
  maxDifficulty: 1,
  weight: 3,
  build({ rng, difficulty, mode, gravity }) {
    const width = rng.int(16, 22);
    const clearance = Math.round(lerp(5, 4, difficulty) * 2) / 2;
    const base = FLOOR_TOP;
    const objects = corridor(width, base, base, clearance);
    const spacing = Math.round(lerp(8, 6, difficulty));

    for (let x = 6; x < width - 4; x += spacing) {
      if (rng.chance(0.5)) {
        objects.push(spike(x, base));
      } else {
        objects.push(ceilingSpike(x, base + clearance));
      }
    }

    return { objects, width, mode, gravity };
  },
};

// --- Transitions -----------------------------------------------------------

const PORTAL_FOR_MODE: Record<GameMode, LevelObjectType> = {
  cube: "cubePortal",
  ship: "shipPortal",
  ball: "ballPortal",
};

/**
 * Mode changes are placed deliberately by the assembler rather than rolled at
 * random, so a level advertised as a ship level actually contains one. The
 * runway either side of the portal gives the new mode room to settle.
 */
export function buildModePortal(from: GameMode, to: GameMode, gravity: Gravity): Chunk {
  const width = 14;
  const clearance = 5;
  const objects: DraftObject[] =
    from === "cube" ? [floor(0, width)] : corridor(width, FLOOR_TOP, FLOOR_TOP, clearance);

  objects.push({ type: PORTAL_FOR_MODE[to], x: 6, y: FLOOR_TOP, width: 1, height: 3 });

  if (to !== "cube") {
    // The new mode needs a channel to fly into immediately after the portal.
    for (let x = 5; x < width; x += 1) {
      objects.push(ceiling(x, 1, FLOOR_TOP + clearance));
    }
  }

  return { objects, width, mode: to, gravity };
}

export function buildGravityFlip(mode: GameMode, gravity: Gravity): Chunk {
  const width = 20;
  const clearance = 5;
  const objects = corridor(width, FLOOR_TOP, FLOOR_TOP, clearance);
  const next = (gravity * -1) as Gravity;

  objects.push({
    type: next === -1 ? "gravityUpPortal" : "gravityDownPortal",
    x: 7,
    y: FLOOR_TOP,
    width: 1,
    height: clearance,
  });

  return { objects, width, mode, gravity: next };
}

export const CHUNK_BUILDERS: ChunkBuilder[] = [
  cubeFlat,
  cubeSpikes,
  cubeTallSpike,
  cubePit,
  cubeStairs,
  cubePlatforms,
  cubePad,
  cubeOrb,
  shipCorridor,
  shipSpikes,
  ballCorridor,
];

/** Opening runway — always cube, always trivial, so a run starts cleanly. */
export function buildIntro(gravity: Gravity): Chunk {
  const width = 12;
  return { objects: [floor(0, width)], width, mode: "cube", gravity };
}

/** Closing runway plus the finish gate. */
export function buildOutro(mode: GameMode, gravity: Gravity): Chunk {
  const width = 14;
  const objects: DraftObject[] =
    mode === "cube" ? [floor(0, width)] : corridor(width, FLOOR_TOP, FLOOR_TOP, 5);

  objects.push({ type: "finishGate", x: width - 5, y: FLOOR_TOP, width: 1, height: 4 });
  return { objects, width, mode, gravity };
}

export function eligibleBuilders(mode: GameMode, difficulty: number): ChunkBuilder[] {
  return CHUNK_BUILDERS.filter(
    (builder) =>
      builder.modes.includes(mode) &&
      difficulty >= builder.minDifficulty &&
      difficulty <= builder.maxDifficulty,
  );
}

export function pickBuilder(
  rng: Random,
  mode: GameMode,
  difficulty: number,
): ChunkBuilder | null {
  const options = eligibleBuilders(mode, difficulty);
  if (options.length === 0) {
    return null;
  }
  return rng.weighted(options.map((builder) => ({ value: builder, weight: builder.weight })));
}
