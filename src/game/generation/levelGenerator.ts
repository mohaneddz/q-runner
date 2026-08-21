import { nanoid } from "nanoid";
import {
  DEFAULT_BASE_SPEED,
  FIXED_DT,
  PLAYER_START_X,
  PLAYER_START_Y,
  PLAYER_START_Y_FLIPPED,
} from "@/game/core/constants";
import { cloneSimState, createSimState, stepSimulation, type SimState } from "@/game/core/simulation";
import {
  buildGravityFlip,
  buildIntro,
  buildModePortal,
  buildOutro,
  pickBuilder,
  type Chunk,
  type DraftObject,
} from "@/game/generation/chunks";
import { resolveObjects, SpatialIndex, type LevelContext } from "@/game/level/levelGeometry";
import type { LevelData, LevelObject } from "@/game/level/levelSchema";
import { definitionFor, isSolid, type GameMode, type Gravity } from "@/game/level/objectCatalog";
import type { ThemeId } from "@/game/render/themes";
import { HUMAN_INPUT_GRANULARITY } from "@/game/validation/reachabilitySolver";
import { Random } from "@/utils/random";

interface Checkpoint {
  states: SimState[];
  tick: number;
}

/** Stand-in level length while generating, so nothing finishes early. */
const OPEN_ENDED = 1e9;
const BEAM_WIDTH = 700;
const CHUNK_ATTEMPTS = 14;

/**
 * Carries a beam of surviving states forward as chunks are appended. A chunk
 * is only kept if the beam can still reach its far edge, which makes every
 * generated level solvable by construction rather than by luck.
 */
class IncrementalSolver {
  private frontier: SimState[];
  private context: LevelContext;
  /** Continuous across calls so the input grid never resets at a chunk seam. */
  private tick = 0;

  constructor(baseSpeed: number, mode: GameMode, gravity: Gravity) {
    this.frontier = [
      createSimState(
        mode,
        gravity,
        PLAYER_START_X,
        gravity === 1 ? PLAYER_START_Y : PLAYER_START_Y_FLIPPED,
      ),
    ];
    this.context = {
      objects: [],
      index: new SpatialIndex([]),
      length: OPEN_ENDED,
      baseSpeed,
    };
  }

  setObjects(objects: DraftObject[]): void {
    const resolved = resolveObjects(objects.map((draft, index) => toLevelObject(draft, index)));
    this.context = { ...this.context, objects: resolved, index: new SpatialIndex(resolved) };
  }

  save(): Checkpoint {
    return { states: this.frontier.map(cloneSimState), tick: this.tick };
  }

  restore(checkpoint: Checkpoint): void {
    this.frontier = checkpoint.states.map(cloneSimState);
    this.tick = checkpoint.tick;
  }

  get x(): number {
    return this.frontier[0]?.x ?? PLAYER_START_X;
  }

  /** Runs the beam to `targetX`. False means the section is impossible. */
  advanceTo(targetX: number): boolean {
    const maxTicks = Math.ceil((targetX - this.x) / (this.context.baseSpeed * FIXED_DT)) + 8;

    for (let step = 0; step < maxTicks; step += 1) {
      if (this.x >= targetX) {
        return true;
      }

      const canChangeInput = this.tick % HUMAN_INPUT_GRANULARITY === 0;
      this.tick += 1;

      const seen = new Map<string, SimState>();
      for (const state of this.frontier) {
        for (const hold of canChangeInput ? [false, true] : [state.held]) {
          const next = cloneSimState(state);
          const outcome = stepSimulation(next, hold, this.context);
          if (outcome.dead || outcome.finished) {
            continue;
          }
          const key = [
            Math.round(next.y * 16),
            Math.round(next.vy * 8),
            next.mode,
            next.gravity,
            next.grounded ? 1 : 0,
            next.held ? 1 : 0,
          ].join("|");
          if (!seen.has(key)) {
            seen.set(key, next);
          }
        }
      }

      if (seen.size === 0) {
        return false;
      }

      const candidates = [...seen.values()].sort((a, b) => a.y - b.y);
      this.frontier =
        candidates.length <= BEAM_WIDTH
          ? candidates
          : Array.from({ length: BEAM_WIDTH }, (_, i) =>
              candidates[Math.floor((i * candidates.length) / BEAM_WIDTH)],
            );
    }

    return this.x >= targetX;
  }
}

/**
 * Ids are positional rather than random. Object ids only have to be unique
 * within a level, and using nanoid here made regeneration produce a different
 * file every time — which defeats the point of seeding.
 */
function toLevelObject(draft: DraftObject, index: number): LevelObject {
  return {
    id: `o${index}`,
    type: draft.type,
    x: draft.x,
    y: draft.y,
    rotation: draft.rotation ?? 0,
    ...(draft.width === undefined ? {} : { width: draft.width }),
    ...(draft.height === undefined ? {} : { height: draft.height }),
  };
}

function shift(chunk: Chunk, offset: number): DraftObject[] {
  return chunk.objects.map((object) => ({ ...object, x: object.x + offset }));
}

/**
 * Corridors are emitted one cell at a time so their profile can slope. Runs of
 * touching, identical solids collapse into single wide objects afterwards —
 * collision is axis-aligned, so this is behaviour-preserving, and it cuts both
 * the file size and the per-tick object count by roughly a third.
 */
function mergeSolids(objects: DraftObject[]): DraftObject[] {
  const merged: DraftObject[] = [];
  const runs = new Map<string, DraftObject[]>();

  for (const object of objects) {
    if (!isSolid(object.type)) {
      merged.push(object);
      continue;
    }
    const height = object.height ?? definitionFor(object.type).height;
    const key = `${object.type}|${object.y}|${height}|${object.rotation ?? 0}`;
    const bucket = runs.get(key);
    if (bucket) {
      bucket.push(object);
    } else {
      runs.set(key, [object]);
    }
  }

  for (const bucket of runs.values()) {
    bucket.sort((a, b) => a.x - b.x);
    let current: DraftObject | null = null;

    for (const object of bucket) {
      const width = object.width ?? definitionFor(object.type).width;
      if (current) {
        const currentWidth = current.width ?? definitionFor(current.type).width;
        if (Math.abs(current.x + currentWidth - object.x) < 1e-6) {
          current.width = currentWidth + width;
          continue;
        }
        merged.push(current);
      }
      current = { ...object, width };
    }

    if (current) {
      merged.push(current);
    }
  }

  return merged.sort((a, b) => a.x - b.x);
}

export interface LevelSection {
  mode: GameMode;
  /** Share of the level body this section gets, relative to the others. */
  weight: number;
  /** Flip gravity on entering the section. */
  flipGravity?: boolean;
}

export interface GenerateLevelOptions {
  seed: number;
  name: string;
  author?: string;
  /** Target level length in units; the result lands near this. */
  targetLength: number;
  baseSpeed?: number;
  theme: ThemeId;
  /** Difficulty at the start and end of the level, ramped linearly between. */
  difficultyFrom: number;
  difficultyTo: number;
  startGravity?: Gravity;
  id?: string;
  /** Ordered mode plan. Defaults to a single cube section. */
  sections?: LevelSection[];
  /**
   * Fixed creation timestamp. The built-in generator passes one so
   * regenerating produces byte-identical files instead of a diff every run.
   */
  timestamp?: string;
}

const OUTRO_WIDTH = 14;
const FILLER_WIDTH = 8;

export function generateLevel(options: GenerateLevelOptions): LevelData {
  const rng = new Random(options.seed);
  const baseSpeed = options.baseSpeed ?? DEFAULT_BASE_SPEED;
  const startGravity: Gravity = options.startGravity ?? 1;
  const sections = options.sections ?? [{ mode: "cube" as GameMode, weight: 1 }];

  const solver = new IncrementalSolver(baseSpeed, "cube", startGravity);
  const intro = buildIntro(startGravity);

  let objects: DraftObject[] = shift(intro, 0);
  let cursor = intro.width;
  let mode: GameMode = intro.mode;
  let gravity: Gravity = intro.gravity;

  solver.setObjects(objects);
  solver.advanceTo(cursor);

  const bodyTarget = Math.max(options.targetLength - OUTRO_WIDTH, 40);

  const difficultyAt = (x: number) => {
    const span = Math.max(1, bodyTarget - intro.width);
    const progress = Math.min(1, Math.max(0, (x - intro.width) / span));
    return options.difficultyFrom + (options.difficultyTo - options.difficultyFrom) * progress;
  };

  /** Commits the chunk only if the beam can still cross it. */
  const tryAppend = (chunk: Chunk): boolean => {
    const checkpoint = solver.save();
    const candidate = [...objects, ...shift(chunk, cursor)];
    solver.setObjects(candidate);

    if (solver.advanceTo(cursor + chunk.width)) {
      objects = candidate;
      cursor += chunk.width;
      mode = chunk.mode;
      gravity = chunk.gravity;
      return true;
    }

    solver.restore(checkpoint);
    solver.setObjects(objects);
    return false;
  };

  const appendFiller = (): boolean =>
    tryAppend({
      objects: [{ type: "spanPlatform", x: 0, y: 0, width: FILLER_WIDTH, height: 1 }],
      width: FILLER_WIDTH,
      mode,
      gravity,
    });

  let remainingWeight = sections.reduce((sum, section) => sum + section.weight, 0);

  for (const section of sections) {
    const budget = ((bodyTarget - cursor) * section.weight) / Math.max(remainingWeight, 1e-6);
    const sectionEnd = cursor + budget;
    remainingWeight -= section.weight;

    if (section.mode !== mode && !tryAppend(buildModePortal(mode, section.mode, gravity))) {
      // A portal that cannot be entered would strand the run; skip the section.
      continue;
    }

    if (section.flipGravity) {
      tryAppend(buildGravityFlip(mode, gravity));
    }

    while (cursor < sectionEnd) {
      const difficulty = difficultyAt(cursor);
      let placed = false;

      for (let attempt = 0; attempt < CHUNK_ATTEMPTS; attempt += 1) {
        const builder = pickBuilder(rng, mode, difficulty);
        if (!builder) {
          break;
        }
        if (tryAppend(builder.build({ rng, difficulty, mode, gravity }))) {
          placed = true;
          break;
        }
      }

      if (!placed && !appendFiller()) {
        // Nothing can follow this state; stop extending rather than spin.
        break;
      }
    }
  }

  // The finish gate needs a landing surface, which only cube mode guarantees.
  if (mode !== "cube") {
    tryAppend(buildModePortal(mode, "cube", gravity));
  }
  if (gravity !== 1) {
    tryAppend(buildGravityFlip(mode, gravity));
  }

  const outro = buildOutro(mode, gravity);
  objects = [...objects, ...shift(outro, cursor)];
  cursor += outro.width;

  const now = options.timestamp ?? new Date().toISOString();
  return {
    version: 1,
    meta: {
      id: options.id ?? `level${nanoid(8)}`,
      name: options.name,
      author: options.author ?? "Q-Runner",
      createdAt: now,
      updatedAt: now,
      seed: options.seed,
    },
    settings: {
      length: cursor,
      baseSpeed,
      startMode: "cube",
      startGravity,
      theme: options.theme,
      musicBpm: 128,
    },
    objects: mergeSolids(objects).map((draft, index) => toLevelObject(draft, index)),
  };
}
