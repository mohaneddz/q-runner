# Q-Runner

A deterministic browser auto-runner with cube, ship and ball modes, a level editor, an endless
mode and an in-browser Q-learning agent. No backend, no physics engine, no game framework — the
simulation is hand-rolled and runs entirely client-side.

Built with Next.js (App Router) + TypeScript, Zod for the level schema, Zustand for editor state,
localForage for persistence, and a plain 2D canvas for rendering.

## The idea

A fixed 120Hz simulation lives in one pure step function. The game loop, the training
environment and a reachability solver all call that same function, which is what makes the
central claim hold: **a level cannot ship unless the solver has proved it clearable.**

The solver is allowed to change its input only once every six ticks — a 50ms grid. So "solvable"
means solvable with roughly human timing slack, not frame-perfectly. `pnpm build` runs it over
all ten built-in levels and fails the build on any rejection.

## What's here

- **`/levels`** — the ten built-in levels plus anything you have built, with best progress and
  clear state per level.
- **`/play`** — the game. Hold to jump, fly or flip depending on the mode. You can also watch a
  scripted baseline bot, or watch the solver's own winning route replayed.
- **`/editor`** — pan/zoom canvas, place, erase, marquee multi-select, drag, snapping, undo/redo,
  an inspector for object and level settings, JSON import/export, and a **Check** button that
  runs the level through the same solver the built-in levels pass.
- **`/endless`** — stages generated on the fly and rejected unless the solver can still cross
  them. Difficulty and speed climb per stage. The next stage is built while you play the current
  one, and a run is reproducible from its seed (`?seed=…`).
- **`/training`** — a tabular Q-learning agent training against the same engine, with a learning
  curve, throughput and state-coverage metrics, and a viewer that runs the greedy policy. Agents
  are saved per level.

### Game objects

Platforms (tile, span, block, floating, ceiling), spikes (single, double, triple, tall, mini,
inverted), yellow and pink pads and orbs, cube/ship/ball portals, gravity portals, and a finish
gate. Hazards use a hitbox smaller than the drawn spike so clipping a corner is survivable.

## Setup

```bash
pnpm install
pnpm dev
```

## Scripts

| Command | What it does |
| --- | --- |
| `pnpm dev` | Dev server |
| `pnpm build` | Validates every built-in level, then builds |
| `pnpm check` | Typecheck, lint, tests, level validation |
| `pnpm test` | 95 tests via `node:test` |
| `pnpm validate:levels` | Solve every built-in level end to end |
| `pnpm generate:levels` | Regenerate the ten built-in levels (deterministic per seed) |
| `pnpm generate:icons` | Redraw favicons and the social card |
| `pnpm preview [level] [ticks…]` | Render frames of a level to PNG via a headless canvas |

`pnpm preview` replays a solved route and writes frames to `previews/`. It is a visual smoke test
for the renderer that does not need a browser.

## Level format

Levels are version-1 JSON validated by a Zod schema (`src/game/level/levelSchema.ts`), in world
units rather than pixels — the same unit the editor grid, the renderer and the solver all use.
The ten built-in levels live in `src/data/builtinLevels/` and are generated, not hand-placed:
chunks are appended only if a beam of surviving states can still cross them.

Regenerating is deterministic. Object ids are positional and the authoring timestamp is pinned,
so `pnpm generate:levels` twice produces byte-identical files.

## Tests

`pnpm test` covers the simulation, the solver, generation, the editor store and the renderer.
The one that matters most replays the solver's own winning route through the real `GameEngine`
for each shipped level and asserts it finishes — if the engine and the solver ever drift apart,
"validated" quietly stops meaning anything.

## Known limitations

- **Progress and levels are per-browser.** Everything is in IndexedDB via localForage. There is
  no account, no sync, and clearing site data loses saved levels.
- **Landscape only on mobile.** The game is a 16:9 canvas and reads badly in portrait.
- **The trained agent is a demo, not a solver.** A tabular Q-table over a discretised state does
  learn to clear the early levels, but the late ones need mode-specific timing it cannot
  represent. The reachability solver is the thing that actually proves a level clearable.
- **Rotation is presentation-only.** Objects can be rotated for looks; collision stays
  axis-aligned, which is what the solver assumes.
- **No music.** There are sound effects for jump, death, orbs and portals; `musicBpm` is carried
  in the level format but nothing reads it yet.
