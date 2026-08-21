"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { snapPoint } from "@/game/editor/grid";
import { useEditorStore } from "@/game/editor/editorStore";
import { resolveObject, resolveObjects, type ResolvedObject } from "@/game/level/levelGeometry";
import type { LevelObject } from "@/game/level/levelSchema";
import { definitionFor } from "@/game/level/objectCatalog";
import { EditorRenderer, type Marquee } from "@/game/render/EditorRenderer";

type DragMode = "none" | "pan" | "move" | "marquee" | "paint" | "erase";

function hitTest(objects: ResolvedObject[], worldX: number, worldY: number): ResolvedObject | null {
  // Back to front, so the most recently drawn object wins a click.
  for (let i = objects.length - 1; i >= 0; i -= 1) {
    const object = objects[i];
    if (
      worldX >= object.x &&
      worldX <= object.right &&
      worldY >= object.y &&
      worldY <= object.top
    ) {
      return object;
    }
  }
  return null;
}

function intersects(object: ResolvedObject, marquee: Marquee): boolean {
  return (
    object.x < marquee.x + marquee.width &&
    object.right > marquee.x &&
    object.y < marquee.y + marquee.height &&
    object.top > marquee.y
  );
}

export function EditorCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<EditorRenderer | null>(null);

  const dragMode = useRef<DragMode>("none");
  const dragOrigin = useRef({ x: 0, y: 0 });
  const dragLast = useRef({ x: 0, y: 0 });
  const paintedCells = useRef(new Set<string>());
  const spaceHeld = useRef(false);

  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [marquee, setMarquee] = useState<Marquee | null>(null);
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);

  // Mirrors of transient state the render loop reads without a re-render.
  const hoveredRef = useRef<string | null>(null);
  const marqueeRef = useRef<Marquee | null>(null);
  const cursorRef = useRef<{ x: number; y: number } | null>(null);
  useEffect(() => {
    hoveredRef.current = hoveredId;
    marqueeRef.current = marquee;
    cursorRef.current = cursor;
  });

  const toWorld = useCallback((event: { clientX: number; clientY: number }) => {
    const canvas = canvasRef.current;
    const renderer = rendererRef.current;
    if (!canvas || !renderer) {
      return null;
    }
    const rect = canvas.getBoundingClientRect();
    return {
      x: renderer.toWorldX(event.clientX - rect.left),
      y: renderer.toWorldY(event.clientY - rect.top),
    };
  }, []);

  // Render loop. Reading the store per frame keeps the canvas in step with the
  // sidebar without re-rendering React on every pointer move.
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) {
      return;
    }

    const renderer = new EditorRenderer(canvas);
    rendererRef.current = renderer;

    const applySize = () => {
      const rect = container.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        renderer.resize(rect.width, rect.height, window.devicePixelRatio || 1);
      }
    };
    applySize();
    const observer = new ResizeObserver(applySize);
    observer.observe(container);

    let raf = 0;
    const frame = () => {
      const state = useEditorStore.getState();
      const objects = resolveObjects(state.level.objects);

      let preview: ResolvedObject | null = null;
      if (state.tool === "place" && cursorRef.current) {
        const definition = definitionFor(state.placeType);
        const snapped = snapPoint(cursorRef.current.x, cursorRef.current.y, state.snap);
        const ghost: LevelObject = {
          id: "preview",
          type: state.placeType,
          x: snapped.x,
          y: snapped.y,
          rotation: 0,
          width: definition.width,
          height: definition.height,
        };
        preview = resolveObject(ghost);
      }

      renderer.render({
        level: state.level,
        objects,
        selectedIds: state.selectedIds,
        hoveredId: hoveredRef.current,
        marquee: marqueeRef.current,
        camera: state.camera,
        preview,
      });
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      rendererRef.current = null;
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) {
        return;
      }

      const store = useEditorStore.getState();

      if (event.code === "Space") {
        spaceHeld.current = true;
        event.preventDefault();
        return;
      }
      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        store.deleteSelected();
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) {
          store.redo();
        } else {
          store.undo();
        }
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "y") {
        event.preventDefault();
        store.redo();
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "d") {
        event.preventDefault();
        store.duplicateSelected();
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "a") {
        event.preventDefault();
        store.selectAll();
        return;
      }

      const step = event.shiftKey ? 1 : store.snap;
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        store.nudgeSelected(-step, 0);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        store.nudgeSelected(step, 0);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        store.nudgeSelected(0, step);
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        store.nudgeSelected(0, -step);
      }
    };

    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code === "Space") {
        spaceHeld.current = false;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  const onPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const world = toWorld(event);
    if (!world) {
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    dragOrigin.current = world;
    dragLast.current = world;

    const store = useEditorStore.getState();

    if (event.button === 1 || spaceHeld.current) {
      dragMode.current = "pan";
      return;
    }

    const objects = resolveObjects(store.level.objects);
    const hit = hitTest(objects, world.x, world.y);

    if (store.tool === "erase") {
      dragMode.current = "erase";
      if (hit) {
        store.eraseAt(hit.id);
      }
      return;
    }

    if (store.tool === "place") {
      dragMode.current = "paint";
      paintedCells.current.clear();
      const snapped = snapPoint(world.x, world.y, store.snap);
      paintedCells.current.add(`${snapped.x}:${snapped.y}`);
      store.placeAt(world.x, world.y);
      return;
    }

    if (hit) {
      if (event.shiftKey) {
        store.toggleSelected(hit.id);
      } else if (!store.selectedIds.includes(hit.id)) {
        store.select([hit.id]);
      }
      dragMode.current = "move";
      store.beginDrag();
      return;
    }

    if (!event.shiftKey) {
      store.clearSelection();
    }
    dragMode.current = "marquee";
    setMarquee({ x: world.x, y: world.y, width: 0, height: 0 });
  };

  const onPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const world = toWorld(event);
    if (!world) {
      return;
    }
    setCursor(world);

    const store = useEditorStore.getState();
    const mode = dragMode.current;

    if (mode === "none") {
      const objects = resolveObjects(store.level.objects);
      setHoveredId(hitTest(objects, world.x, world.y)?.id ?? null);
      return;
    }

    if (mode === "pan") {
      store.panBy(dragLast.current.x - world.x, dragLast.current.y - world.y);
      // Panning moves the world under the cursor, so re-read rather than
      // accumulating drift from the pre-pan coordinate.
      const updated = toWorld(event);
      dragLast.current = updated ?? world;
      return;
    }

    if (mode === "move") {
      store.moveSelectedBy(world.x - dragLast.current.x, world.y - dragLast.current.y);
      dragLast.current = world;
      return;
    }

    if (mode === "paint") {
      const snapped = snapPoint(world.x, world.y, store.snap);
      const key = `${snapped.x}:${snapped.y}`;
      if (!paintedCells.current.has(key)) {
        paintedCells.current.add(key);
        store.placeAt(world.x, world.y);
      }
      return;
    }

    if (mode === "erase") {
      const objects = resolveObjects(store.level.objects);
      const hit = hitTest(objects, world.x, world.y);
      if (hit) {
        store.eraseAt(hit.id);
      }
      return;
    }

    if (mode === "marquee") {
      setMarquee({
        x: Math.min(dragOrigin.current.x, world.x),
        y: Math.min(dragOrigin.current.y, world.y),
        width: Math.abs(world.x - dragOrigin.current.x),
        height: Math.abs(world.y - dragOrigin.current.y),
      });
    }
  };

  const onPointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const store = useEditorStore.getState();

    if (dragMode.current === "marquee" && marqueeRef.current) {
      const box = marqueeRef.current;
      if (box.width > 0.1 || box.height > 0.1) {
        const inside = resolveObjects(store.level.objects)
          .filter((object) => intersects(object, box))
          .map((object) => object.id);
        store.select(
          event.shiftKey ? [...new Set([...store.selectedIds, ...inside])] : inside,
        );
      }
    }

    if (dragMode.current === "move") {
      store.endDrag();
    }

    dragMode.current = "none";
    setMarquee(null);
    paintedCells.current.clear();
  };

  const onWheel = (event: React.WheelEvent<HTMLCanvasElement>) => {
    const world = toWorld(event);
    if (!world) {
      return;
    }
    const factor = event.deltaY < 0 ? 1.12 : 1 / 1.12;
    useEditorStore.getState().zoomAt(factor, world.x, world.y);
  };

  return (
    <div ref={containerRef} className="editorCanvasWrap">
      <canvas
        ref={canvasRef}
        className="editorCanvas"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={() => {
          setHoveredId(null);
          setCursor(null);
        }}
        onWheel={onWheel}
        onContextMenu={(event) => event.preventDefault()}
      />
    </div>
  );
}
