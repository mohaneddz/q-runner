import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { createBlankLevel, useEditorStore } from "@/game/editor/editorStore";
import { isSolvable } from "@/game/validation/reachabilitySolver";

const store = () => useEditorStore.getState();

function reset() {
  useEditorStore.setState({
    level: createBlankLevel("Fixture"),
    tool: "place",
    placeType: "spanPlatform",
    selectedIds: [],
    camera: { x: 0, y: 0, zoom: 1 },
    snap: 1,
    past: [],
    future: [],
    dragging: false,
  });
}

describe("editor store", () => {
  beforeEach(reset);

  it("places an object and selects it", () => {
    const before = store().level.objects.length;
    store().placeAt(10.4, 3.2);

    const after = store().level.objects;
    assert.equal(after.length, before + 1);
    assert.equal(store().selectedIds.length, 1);

    const placed = after[after.length - 1];
    assert.equal(placed.x, 10, "snapped to the grid");
    assert.equal(placed.y, 3);
  });

  it("undoes and redoes a placement", () => {
    const before = store().level.objects.length;
    store().placeAt(4, 4);
    assert.equal(store().level.objects.length, before + 1);

    store().undo();
    assert.equal(store().level.objects.length, before);

    store().redo();
    assert.equal(store().level.objects.length, before + 1);
  });

  it("coalesces a drag into a single undo step", () => {
    store().placeAt(4, 4);
    const id = store().selectedIds[0];
    const startX = store().level.objects.find((object) => object.id === id)!.x;

    store().beginDrag();
    for (let i = 0; i < 30; i += 1) {
      store().moveSelectedBy(1, 0);
    }
    store().endDrag();

    const moved = store().level.objects.find((object) => object.id === id)!;
    assert.notEqual(moved.x, startX, "the drag moved nothing");

    store().undo();
    const restored = store().level.objects.find((object) => object.id === id)!;
    assert.equal(restored.x, startX, "one undo did not revert the whole drag");
  });

  it("moves every selected object together", () => {
    store().placeAt(4, 4);
    const first = store().selectedIds[0];
    store().placeAt(12, 4);
    const second = store().selectedIds[0];

    store().select([first, second]);
    store().beginDrag();
    store().moveSelectedBy(3, 2);
    store().endDrag();

    const objects = store().level.objects;
    assert.equal(objects.find((object) => object.id === first)!.x, 7);
    assert.equal(objects.find((object) => object.id === second)!.x, 15);
  });

  it("deletes the whole selection at once", () => {
    store().placeAt(4, 4);
    store().placeAt(12, 4);
    store().selectAll();
    store().deleteSelected();

    assert.equal(store().level.objects.length, 0);
    assert.equal(store().selectedIds.length, 0);
  });

  it("duplicates without reusing ids", () => {
    store().placeAt(4, 4);
    store().duplicateSelected();

    const ids = store().level.objects.map((object) => object.id);
    assert.equal(new Set(ids).size, ids.length, "duplicate produced a colliding id");
  });

  it("keeps the point under the cursor fixed while zooming", () => {
    store().setCamera({ x: 10, y: 2, zoom: 1 });
    store().zoomAt(2, 18, 6);

    const { camera } = store();
    // The world point (18, 6) must still map to the same screen offset.
    const beforeOffset = (18 - 10) / 1;
    const afterOffset = (18 - camera.x) / (1 / camera.zoom);
    assert.ok(Math.abs(beforeOffset - afterOffset) < 1e-9);
  });

  it("clamps zoom to a usable range", () => {
    for (let i = 0; i < 40; i += 1) {
      store().zoomAt(2, 0, 0);
    }
    assert.ok(store().camera.zoom <= 3);

    for (let i = 0; i < 80; i += 1) {
      store().zoomAt(0.5, 0, 0);
    }
    assert.ok(store().camera.zoom >= 0.35);
  });

  it("starts a new level with a floor and exactly one finish gate", () => {
    const level = createBlankLevel();
    assert.equal(level.objects.filter((object) => object.type === "finishGate").length, 1);
    assert.ok(level.objects.some((object) => object.type === "spanPlatform"));
  });

  it("starts a new level in a clearable state", () => {
    // Check and Playtest both run the solver, and both used to fail on an
    // untouched new level because the starting floor stopped short of the gate.
    assert.equal(isSolvable(createBlankLevel()), true);
  });
});
