export type LevelObjectType = "platform" | "spike";

export interface LevelObject {
  id: string;
  type: LevelObjectType;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LevelData {
  id: string;
  name: string;
  length: number;
  objects: LevelObject[];
}
