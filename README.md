# Q-Runner

Q-Runner is a deterministic, client-only browser auto-runner with an in-browser level editor and a Q-learning training playground, built with:

- Next.js App Router + TypeScript
- Tailwind (UI layer only)
- raw Three.js for game/editor canvas rendering
- Zustand for editor UI state
- Zod for level schema validation
- localForage for browser persistence (levels, drafts)
- nanoid for IDs

No backend, no physics engine, and no `react-three-fiber` — the simulation core is hand-rolled (fixed-tick game loop, collision, movement) under `src/game/`.

## Status

⚠️ **This repo's git history does not reflect the actual codebase yet.** Only one commit exists (`Initial commit from Create Next App`), and almost the entire game — `src/game/`, `src/components/`, all app routes (`editor`, `play`, `training`), scripts, and public assets — is currently **untracked**. There is no commit-level rollback safety net for any of that code. This should be committed properly as a follow-up; it's out of scope for this README update.

## What's here

- **`/` `/play` `/editor` `/training`** — the four routes that currently exist under `src/app`. `/play` reads a `?level=` query param (not a dynamic `[levelId]` segment) and falls back to a built-in default level (`src/game/level/levelLoader.ts`) when none is saved.
- **Game core** (`src/game/core`, `entities`, `physics`, `input`, `render`) — fixed-tick `GameLoop`/`GameEngine`, platform/spike/finish entities, collision + movement, canvas renderer, and separate human vs. agent input sources.
- **Level editor** (`src/app/editor`, `src/components/editor`) — place/delete/drag tools for platforms and spikes on a snapped grid, an inspector panel for editing selected object properties, save-to-local-storage, JSON export/import, and a one-click "Playtest" that saves the current draft and jumps to `/play`.
- **Training** (`src/app/training`, `src/game/training`) — a from-scratch `QLearningAgent` trained against a `TrainingEnv` wrapping the game core, driven by a `Trainer` that runs batched steps and reports episode/reward/epsilon metrics in a `TrainingPanel`/`MetricsPanel` UI.
- **Level data** — currently a single hard-coded default level (`DEFAULT_LEVEL` in `levelLoader.ts`) plus a Zod schema (`levelTypes.ts`, validated by `scripts/validate-builtins.mjs`). Levels are persisted via `localForage` (`levelStore.ts`) and can be exported/imported as JSON from the editor.

Not currently present in the code (despite being natural next steps): a procedurally-generated endless mode, multiple built-in levels, multi-select/resize in the editor, and undo/redo.

## Setup

```bash
pnpm install
pnpm dev
```

Validate the built-in level(s) against the Zod schema:

```bash
pnpm validate:levels
```

Build / run production:

```bash
pnpm build
pnpm start
```
