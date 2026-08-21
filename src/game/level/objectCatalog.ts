import {
  PINK_ORB_VELOCITY,
  PINK_PAD_VELOCITY,
  YELLOW_ORB_VELOCITY,
  YELLOW_PAD_VELOCITY,
} from "@/game/core/constants";

export type GameMode = "cube" | "ship" | "ball";
export type Gravity = 1 | -1;

export const LEVEL_OBJECT_TYPES = [
  "tilePlatform",
  "spanPlatform",
  "connectedPlatformBlock",
  "floatingPlatformBlock",
  "ceilingBlock",
  "spikeSingle",
  "spikeDouble",
  "spikeTriple",
  "spikeTall",
  "spikeMini",
  "spikeInverted",
  "yellowPad",
  "pinkPad",
  "yellowOrb",
  "pinkOrb",
  "cubePortal",
  "shipPortal",
  "ballPortal",
  "gravityUpPortal",
  "gravityDownPortal",
  "finishGate",
] as const;

export type LevelObjectType = (typeof LEVEL_OBJECT_TYPES)[number];

export type ObjectCategory = "solid" | "hazard" | "pad" | "orb" | "portal" | "goal";

export interface ObjectDefinition {
  category: ObjectCategory;
  label: string;
  width: number;
  height: number;
  /** Whether the editor lets the user stretch this object freely. */
  resizable: boolean;
  /** Launch velocity applied on contact, before the gravity sign is applied. */
  padVelocity?: number;
  /** Launch velocity applied when the player taps while touching. */
  orbVelocity?: number;
  portalMode?: GameMode;
  portalGravity?: Gravity;
}

/**
 * Default footprints match the sizes the build-time validator infers, so a
 * level authored here and a level authored by hand validate identically.
 * Portals are the exception: a one-unit portal is trivially missable in ship
 * mode, so they span a corridor instead.
 */
export const OBJECT_CATALOG: Record<LevelObjectType, ObjectDefinition> = {
  tilePlatform: { category: "solid", label: "Tile", width: 1, height: 1, resizable: true },
  spanPlatform: { category: "solid", label: "Span", width: 4, height: 1, resizable: true },
  connectedPlatformBlock: {
    category: "solid",
    label: "Block",
    width: 1,
    height: 1,
    resizable: true,
  },
  floatingPlatformBlock: {
    category: "solid",
    label: "Floating block",
    width: 2,
    height: 1,
    resizable: true,
  },
  ceilingBlock: { category: "solid", label: "Ceiling", width: 4, height: 1, resizable: true },

  spikeSingle: { category: "hazard", label: "Spike", width: 1, height: 1, resizable: false },
  spikeDouble: { category: "hazard", label: "Spike x2", width: 2, height: 1, resizable: false },
  spikeTriple: { category: "hazard", label: "Spike x3", width: 3, height: 1, resizable: false },
  spikeTall: { category: "hazard", label: "Tall spike", width: 1, height: 2, resizable: false },
  spikeMini: { category: "hazard", label: "Mini spike", width: 1, height: 0.5, resizable: false },
  spikeInverted: {
    category: "hazard",
    label: "Ceiling spike",
    width: 1,
    height: 1,
    resizable: false,
  },

  yellowPad: {
    category: "pad",
    label: "Yellow pad",
    width: 1,
    height: 0.35,
    resizable: false,
    padVelocity: YELLOW_PAD_VELOCITY,
  },
  pinkPad: {
    category: "pad",
    label: "Pink pad",
    width: 1,
    height: 0.35,
    resizable: false,
    padVelocity: PINK_PAD_VELOCITY,
  },
  yellowOrb: {
    category: "orb",
    label: "Yellow orb",
    width: 0.7,
    height: 0.7,
    resizable: false,
    orbVelocity: YELLOW_ORB_VELOCITY,
  },
  pinkOrb: {
    category: "orb",
    label: "Pink orb",
    width: 0.7,
    height: 0.7,
    resizable: false,
    orbVelocity: PINK_ORB_VELOCITY,
  },

  cubePortal: {
    category: "portal",
    label: "Cube portal",
    width: 1,
    height: 3,
    resizable: false,
    portalMode: "cube",
  },
  shipPortal: {
    category: "portal",
    label: "Ship portal",
    width: 1,
    height: 3,
    resizable: false,
    portalMode: "ship",
  },
  ballPortal: {
    category: "portal",
    label: "Ball portal",
    width: 1,
    height: 3,
    resizable: false,
    portalMode: "ball",
  },
  gravityUpPortal: {
    category: "portal",
    label: "Gravity up",
    width: 1,
    height: 3,
    resizable: false,
    portalGravity: -1,
  },
  gravityDownPortal: {
    category: "portal",
    label: "Gravity down",
    width: 1,
    height: 3,
    resizable: false,
    portalGravity: 1,
  },

  finishGate: { category: "goal", label: "Finish", width: 1, height: 3, resizable: false },
};

export function definitionFor(type: LevelObjectType): ObjectDefinition {
  return OBJECT_CATALOG[type];
}

export function isSolid(type: LevelObjectType): boolean {
  return OBJECT_CATALOG[type].category === "solid";
}

export function isDeadly(type: LevelObjectType): boolean {
  return OBJECT_CATALOG[type].category === "hazard";
}

export const OBJECT_TYPES_BY_CATEGORY = LEVEL_OBJECT_TYPES.reduce<
  Record<ObjectCategory, LevelObjectType[]>
>(
  (groups, type) => {
    groups[OBJECT_CATALOG[type].category].push(type);
    return groups;
  },
  { solid: [], hazard: [], pad: [], orb: [], portal: [], goal: [] },
);
