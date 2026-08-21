import { nanoid } from "nanoid";
import { create } from "zustand";
import { DEFAULT_BASE_SPEED } from "@/game/core/constants";
import { snapValue, tidy, type SnapSize } from "@/game/editor/grid";
import { createPlacedObject, duplicateObjects } from "@/game/editor/placement";
import type { LevelData, LevelObject, LevelSettings } from "@/game/level/levelSchema";
import { definitionFor, type LevelObjectType } from "@/game/level/objectCatalog";

export type EditorTool = "select" | "place" | "erase";

const HISTORY_LIMIT = 100;

const BLANK_LENGTH = 80;
const BLANK_FINISH_X = BLANK_LENGTH - 6;

/**
 * A new level starts as an unbroken floor running the full length, so it is
 * clearable from the first frame and the author subtracts from it. Starting
 * with a floor that stopped short meant Check and Playtest both failed before
 * anything had been built.
 */
export function createBlankLevel(name = "Untitled"): LevelData {
  const now = new Date().toISOString();
  return {
    version: 1,
    meta: {
      id: `user${nanoid(8)}`,
      name,
      author: "You",
      createdAt: now,
      updatedAt: now,
    },
    settings: {
      length: BLANK_LENGTH,
      baseSpeed: DEFAULT_BASE_SPEED,
      startMode: "cube",
      startGravity: 1,
      theme: "neon",
    },
    objects: [
      {
        id: `o${nanoid(8)}`,
        type: "spanPlatform",
        x: 0,
        y: 0,
        rotation: 0,
        width: BLANK_FINISH_X + 4,
        height: 1,
      },
      {
        id: `o${nanoid(8)}`,
        type: "finishGate",
        x: BLANK_FINISH_X,
        y: 1,
        rotation: 0,
        width: 1,
        height: 3,
      },
    ],
  };
}

interface Camera {
  x: number;
  y: number;
  zoom: number;
}

interface EditorState {
  level: LevelData;
  tool: EditorTool;
  placeType: LevelObjectType;
  selectedIds: string[];
  camera: Camera;
  snap: SnapSize;
  past: LevelData[];
  future: LevelData[];
  /** Set while a drag is in flight so moves coalesce into one undo step. */
  dragging: boolean;

  setTool: (tool: EditorTool) => void;
  setPlaceType: (type: LevelObjectType) => void;
  setSnap: (snap: SnapSize) => void;

  select: (ids: string[]) => void;
  toggleSelected: (id: string) => void;
  clearSelection: () => void;
  selectAll: () => void;

  placeAt: (x: number, y: number) => void;
  eraseAt: (id: string) => void;
  deleteSelected: () => void;
  duplicateSelected: () => void;
  updateObject: (object: LevelObject) => void;

  beginDrag: () => void;
  moveSelectedBy: (dx: number, dy: number) => void;
  nudgeSelected: (dx: number, dy: number) => void;
  endDrag: () => void;

  updateSettings: (settings: Partial<LevelSettings>) => void;
  rename: (name: string) => void;

  panBy: (dx: number, dy: number) => void;
  setCamera: (camera: Partial<Camera>) => void;
  zoomAt: (factor: number, worldX: number, worldY: number) => void;

  loadLevel: (level: LevelData) => void;
  undo: () => void;
  redo: () => void;
}

export const useEditorStore = create<EditorState>((set, get) => {
  /** Snapshots the current level so the next mutation can be undone. */
  const commit = (mutate: (level: LevelData) => LevelData) => {
    const { level, past } = get();
    const next = mutate(level);
    set({
      level: next,
      past: [...past, level].slice(-HISTORY_LIMIT),
      future: [],
    });
  };

  /** Mutates without touching history — used mid-drag. */
  const amend = (mutate: (level: LevelData) => LevelData) => {
    set({ level: mutate(get().level) });
  };

  return {
    level: createBlankLevel(),
    tool: "place",
    placeType: "spanPlatform",
    selectedIds: [],
    camera: { x: -2, y: -2, zoom: 1 },
    snap: 1,
    past: [],
    future: [],
    dragging: false,

    setTool: (tool) => set({ tool }),
    setPlaceType: (placeType) => set({ placeType }),
    setSnap: (snap) => set({ snap }),

    select: (selectedIds) => set({ selectedIds }),
    toggleSelected: (id) =>
      set((state) => ({
        selectedIds: state.selectedIds.includes(id)
          ? state.selectedIds.filter((entry) => entry !== id)
          : [...state.selectedIds, id],
      })),
    clearSelection: () => set({ selectedIds: [] }),
    selectAll: () => set((state) => ({ selectedIds: state.level.objects.map((o) => o.id) })),

    placeAt: (x, y) => {
      const { placeType, snap } = get();
      const object = createPlacedObject(placeType, x, y, snap);
      commit((level) => ({ ...level, objects: [...level.objects, object] }));
      set({ selectedIds: [object.id] });
    },

    eraseAt: (id) => {
      commit((level) => ({ ...level, objects: level.objects.filter((o) => o.id !== id) }));
      set((state) => ({ selectedIds: state.selectedIds.filter((entry) => entry !== id) }));
    },

    deleteSelected: () => {
      const { selectedIds } = get();
      if (selectedIds.length === 0) {
        return;
      }
      commit((level) => ({
        ...level,
        objects: level.objects.filter((o) => !selectedIds.includes(o.id)),
      }));
      set({ selectedIds: [] });
    },

    duplicateSelected: () => {
      const { selectedIds, level } = get();
      const chosen = level.objects.filter((o) => selectedIds.includes(o.id));
      if (chosen.length === 0) {
        return;
      }
      const span = Math.max(
        ...chosen.map((o) => o.x + (o.width ?? definitionFor(o.type).width)),
      );
      const origin = Math.min(...chosen.map((o) => o.x));
      const copies = duplicateObjects(chosen, span - origin);
      commit((current) => ({ ...current, objects: [...current.objects, ...copies] }));
      set({ selectedIds: copies.map((o) => o.id) });
    },

    updateObject: (object) => {
      commit((level) => ({
        ...level,
        objects: level.objects.map((entry) => (entry.id === object.id ? object : entry)),
      }));
    },

    beginDrag: () => {
      const { level, past } = get();
      set({ dragging: true, past: [...past, level].slice(-HISTORY_LIMIT), future: [] });
    },

    moveSelectedBy: (dx, dy) => {
      const { selectedIds, snap } = get();
      if (selectedIds.length === 0) {
        return;
      }
      amend((level) => ({
        ...level,
        objects: level.objects.map((object) =>
          selectedIds.includes(object.id)
            ? {
                ...object,
                x: tidy(snapValue(object.x + dx, snap)),
                y: tidy(snapValue(object.y + dy, snap)),
              }
            : object,
        ),
      }));
    },

    nudgeSelected: (dx, dy) => {
      const { selectedIds } = get();
      if (selectedIds.length === 0) {
        return;
      }
      commit((level) => ({
        ...level,
        objects: level.objects.map((object) =>
          selectedIds.includes(object.id)
            ? { ...object, x: tidy(object.x + dx), y: tidy(object.y + dy) }
            : object,
        ),
      }));
    },

    endDrag: () => set({ dragging: false }),

    updateSettings: (settings) =>
      commit((level) => ({ ...level, settings: { ...level.settings, ...settings } })),

    rename: (name) => commit((level) => ({ ...level, meta: { ...level.meta, name } })),

    panBy: (dx, dy) =>
      set((state) => ({ camera: { ...state.camera, x: state.camera.x + dx, y: state.camera.y + dy } })),

    setCamera: (camera) => set((state) => ({ camera: { ...state.camera, ...camera } })),

    zoomAt: (factor, worldX, worldY) =>
      set((state) => {
        const zoom = Math.max(0.35, Math.min(3, state.camera.zoom * factor));
        const ratio = zoom / state.camera.zoom;
        // Keep the point under the cursor fixed while the scale changes.
        return {
          camera: {
            zoom,
            x: worldX - (worldX - state.camera.x) / ratio,
            y: worldY - (worldY - state.camera.y) / ratio,
          },
        };
      }),

    loadLevel: (level) => set({ level, selectedIds: [], past: [], future: [] }),

    undo: () => {
      const { past, level, future } = get();
      const previous = past[past.length - 1];
      if (!previous) {
        return;
      }
      set({
        level: previous,
        past: past.slice(0, -1),
        future: [level, ...future].slice(0, HISTORY_LIMIT),
        selectedIds: [],
      });
    },

    redo: () => {
      const { past, level, future } = get();
      const next = future[0];
      if (!next) {
        return;
      }
      set({
        level: next,
        past: [...past, level].slice(-HISTORY_LIMIT),
        future: future.slice(1),
        selectedIds: [],
      });
    },
  };
});
