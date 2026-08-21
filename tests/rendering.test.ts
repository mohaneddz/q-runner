import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { GameEngine } from "@/game/core/GameEngine";
import { AgentInput } from "@/game/input/AgentInput";
import { resolveObjects } from "@/game/level/levelGeometry";
import { LEVEL_OBJECT_TYPES } from "@/game/level/objectCatalog";
import { CanvasRenderer } from "@/game/render/CanvasRenderer";
import { drawObject } from "@/game/render/drawObjects";
import { THEMES, THEME_IDS, resolveTheme } from "@/game/render/themes";
import { level, object } from "./helpers";

/** Records calls so a draw can be asserted on without a real canvas. */
function fakeContext() {
  const calls: string[] = [];
  const noop =
    (name: string) =>
    (...args: unknown[]) => {
      calls.push(`${name}(${args.length})`);
    };

  const context = {
    calls,
    canvas: null as unknown,
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    globalAlpha: 1,
    shadowColor: "",
    shadowBlur: 0,
    font: "",
    fillRect: noop("fillRect"),
    strokeRect: noop("strokeRect"),
    clearRect: noop("clearRect"),
    beginPath: noop("beginPath"),
    closePath: noop("closePath"),
    moveTo: noop("moveTo"),
    lineTo: noop("lineTo"),
    arc: noop("arc"),
    ellipse: noop("ellipse"),
    roundRect: noop("roundRect"),
    fill: noop("fill"),
    stroke: noop("stroke"),
    save: noop("save"),
    restore: noop("restore"),
    translate: noop("translate"),
    rotate: noop("rotate"),
    setTransform: noop("setTransform"),
    setLineDash: noop("setLineDash"),
    fillText: noop("fillText"),
    createLinearGradient: () => ({ addColorStop: noop("addColorStop") }),
  };

  return context;
}

function fakeCanvas() {
  const context = fakeContext();
  const canvas = {
    width: 1280,
    height: 720,
    getContext: () => context,
  };
  context.canvas = canvas;
  return { canvas: canvas as unknown as HTMLCanvasElement, context };
}

const identityView = {
  toScreenX: (x: number) => x * 40,
  toScreenY: (y: number) => 720 - y * 40,
  scale: 40,
};

describe("drawing", () => {
  it("draws every object type in the catalog without throwing", () => {
    const { context } = fakeCanvas();
    const theme = THEMES.neon;

    for (const type of LEVEL_OBJECT_TYPES) {
      const [resolved] = resolveObjects([object(type, 4, 1)]);
      assert.doesNotThrow(
        () =>
          drawObject(
            context as unknown as CanvasRenderingContext2D,
            resolved,
            theme,
            identityView,
            1.5,
          ),
        `drawing ${type} threw`,
      );
    }

    assert.ok(context.calls.length > LEVEL_OBJECT_TYPES.length, "nothing was drawn");
  });

  it("renders a live frame for each mode", () => {
    for (const startMode of ["cube", "ship", "ball"] as const) {
      const { canvas, context } = fakeCanvas();
      const data = level(
        [
          object("spanPlatform", 0, 0, 60, 1),
          object("ceilingBlock", 0, 6, 60, 1),
          object("spikeSingle", 20, 1),
          object("yellowOrb", 26, 3),
          object("pinkPad", 30, 1),
          object("shipPortal", 34, 1, 1, 3),
          object("finishGate", 50, 1, 1, 3),
        ],
        { length: 60, startMode },
      );

      const renderer = new CanvasRenderer(canvas);
      renderer.resize(1280, 720, 1);
      const engine = new GameEngine(data, new AgentInput(() => 0));

      for (let tick = 0; tick < 90; tick += 1) {
        engine.step();
      }

      assert.doesNotThrow(
        () => renderer.render(engine.getSnapshot(), 1 / 60),
        `rendering ${startMode} threw`,
      );
      assert.ok(context.calls.length > 0, `${startMode} produced no draw calls`);
    }
  });

  it("still renders after the player dies", () => {
    const { canvas } = fakeCanvas();
    const data = level([object("spanPlatform", 0, 0, 8, 1)], { length: 200 });
    const renderer = new CanvasRenderer(canvas);
    renderer.resize(1280, 720, 1);

    const engine = new GameEngine(data, new AgentInput(() => 0));
    for (let tick = 0; tick < 2000; tick += 1) {
      engine.step();
      if (engine.getStatus() !== "running") {
        break;
      }
    }

    assert.equal(engine.getStatus(), "dead");
    assert.doesNotThrow(() => renderer.render(engine.getSnapshot(), 1 / 60));
  });
});

describe("themes", () => {
  it("defines every colour for every theme", () => {
    const keys = Object.keys(THEMES.neon) as (keyof (typeof THEMES)["neon"])[];
    for (const id of THEME_IDS) {
      for (const key of keys) {
        assert.ok(THEMES[id][key], `${id}.${String(key)} is empty`);
      }
    }
  });

  it("falls back rather than failing on an unknown theme", () => {
    assert.equal(resolveTheme("somethingElse").id, "neon");
    assert.equal(resolveTheme("ember").id, "ember");
  });
});
