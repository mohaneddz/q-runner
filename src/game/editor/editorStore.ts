import type { LevelData, LevelObject, LevelObjectType } from "@/game/level/levelTypes";
import { createBlankLevel } from "@/game/level/levelLoader";
import { createPlacedObject } from "@/game/editor/placement";
import { snapPoint } from "@/game/editor/grid";

export type EditorTool = "place" | "delete" | "drag";

export interface EditorState {
  level: LevelData;
  tool: EditorTool;
  placeType: LevelObjectType;
  selectedId: string | null;
}

export function createEditorState(level?: LevelData): EditorState {
  return {
    level: level ?? createBlankLevel(),
    tool: "place",
    placeType: "platform",
    selectedId: null,
  };
}

export function addObject(state: EditorState, x: number, y: number): EditorState {
  const object = createPlacedObject(state.placeType, x, y);
  return {
    ...state,
    level: {
      ...state.level,
      objects: [...state.level.objects, object],
    },
    selectedId: object.id,
  };
}

export function removeObject(state: EditorState, id: string): EditorState {
  return {
    ...state,
    level: {
      ...state.level,
      objects: state.level.objects.filter((object) => object.id !== id),
    },
    selectedId: state.selectedId === id ? null : state.selectedId,
  };
}

export function moveObject(state: EditorState, id: string, x: number, y: number): EditorState {
  const snapped = snapPoint(x, y);
  return {
    ...state,
    level: {
      ...state.level,
      objects: state.level.objects.map((object) =>
        object.id === id ? { ...object, x: snapped.x, y: snapped.y } : object,
      ),
    },
  };
}

export function updateObject(state: EditorState, next: LevelObject): EditorState {
  return {
    ...state,
    level: {
      ...state.level,
      objects: state.level.objects.map((object) => (object.id === next.id ? next : object)),
    },
  };
}

export function getObjectById(level: LevelData, id: string | null): LevelObject | null {
  if (!id) {
    return null;
  }
  return level.objects.find((object) => object.id === id) ?? null;
}
