import { z } from "zod";
import { LEVEL_OBJECT_TYPES, type LevelObjectType } from "@/game/level/objectCatalog";
import { THEME_IDS } from "@/game/render/themes";

export const LEVEL_FORMAT_VERSION = 1;

export const levelObjectSchema = z.object({
  id: z.string().min(1),
  type: z.enum(LEVEL_OBJECT_TYPES),
  x: z.number(),
  y: z.number(),
  rotation: z.number(),
  width: z.number().positive().optional(),
  height: z.number().positive().optional(),
  params: z.record(z.string(), z.unknown()).optional(),
});

export const levelSchema = z.object({
  version: z.literal(LEVEL_FORMAT_VERSION),
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
    theme: z.enum(THEME_IDS),
    musicBpm: z.number().optional(),
  }),
  objects: z.array(levelObjectSchema),
});

export type LevelObject = z.infer<typeof levelObjectSchema>;
export type LevelData = z.infer<typeof levelSchema>;
export type LevelSettings = LevelData["settings"];
export type LevelMeta = LevelData["meta"];

export type { LevelObjectType };

export function parseLevel(input: unknown): LevelData {
  return levelSchema.parse(input);
}

export function safeParseLevel(input: unknown) {
  return levelSchema.safeParse(input);
}

export function formatLevelIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join(", ");
}
