"use client";

import { useEffect, useMemo, useRef } from "react";
import { CANVAS_HEIGHT, CANVAS_WIDTH, GRID_SIZE } from "@/game/core/constants";
import type { LevelData, LevelObject, LevelObjectType } from "@/game/level/levelTypes";

interface EditorCanvasProps {
  level: LevelData;
  tool: "place" | "delete" | "drag";
  placeType: LevelObjectType;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onPlace: (x: number, y: number) => void;
  onDelete: (id: string) => void;
  onMove: (id: string, x: number, y: number) => void;
}

function findObject(level: LevelData, worldX: number, worldY: number): LevelObject | null {
  for (let i = level.objects.length - 1; i >= 0; i -= 1) {
    const object = level.objects[i];
    if (
      worldX >= object.x &&
      worldX <= object.x + object.width &&
      worldY >= object.y &&
      worldY <= object.y + object.height
    ) {
      return object;
    }
  }
  return null;
}

export function EditorCanvas({
  level,
  tool,
  placeType,
  selectedId,
  onSelect,
  onPlace,
  onDelete,
  onMove,
}: EditorCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dragIdRef = useRef<string | null>(null);

  const objectsKey = useMemo(
    () => level.objects.map((object) => `${object.id}:${object.x}:${object.y}`).join("|"),
    [level.objects],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.fillStyle = "#070b16";
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    ctx.strokeStyle = "rgba(32,241,255,0.14)";
    for (let x = 0; x < CANVAS_WIDTH; x += GRID_SIZE) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, CANVAS_HEIGHT);
      ctx.stroke();
    }
    for (let y = 0; y < CANVAS_HEIGHT; y += GRID_SIZE) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(CANVAS_WIDTH, y);
      ctx.stroke();
    }

    for (const object of level.objects) {
      if (object.type === "platform") {
        ctx.fillStyle = "#16d3ff";
        ctx.fillRect(object.x, object.y, object.width, object.height);
      } else {
        ctx.fillStyle = "#ff4dbf";
        ctx.beginPath();
        ctx.moveTo(object.x, object.y + object.height);
        ctx.lineTo(object.x + object.width, object.y + object.height);
        ctx.lineTo(object.x + object.width / 2, object.y);
        ctx.closePath();
        ctx.fill();
      }

      if (object.id === selectedId) {
        ctx.strokeStyle = "#81ff6f";
        ctx.lineWidth = 2;
        ctx.strokeRect(object.x - 2, object.y - 2, object.width + 4, object.height + 4);
      }
    }
  }, [objectsKey, selectedId, level]);

  return (
    <canvas
      ref={canvasRef}
      width={CANVAS_WIDTH}
      height={CANVAS_HEIGHT}
      style={{ width: "100%", maxWidth: 1100, borderRadius: 12, border: "1px solid rgba(255,255,255,0.15)" }}
      onMouseDown={(event) => {
        const canvas = canvasRef.current;
        if (!canvas) {
          return;
        }
        const rect = canvas.getBoundingClientRect();
        const scaleX = CANVAS_WIDTH / rect.width;
        const scaleY = CANVAS_HEIGHT / rect.height;
        const worldX = (event.clientX - rect.left) * scaleX;
        const worldY = (event.clientY - rect.top) * scaleY;

        const hit = findObject(level, worldX, worldY);

        if (tool === "place") {
          onPlace(worldX, worldY - (placeType === "spike" ? GRID_SIZE : 0));
          return;
        }

        if (tool === "delete") {
          if (hit) {
            onDelete(hit.id);
          }
          return;
        }

        if (tool === "drag") {
          dragIdRef.current = hit?.id ?? null;
          onSelect(hit?.id ?? null);
        }
      }}
      onMouseMove={(event) => {
        if (tool !== "drag" || !dragIdRef.current) {
          return;
        }
        const canvas = canvasRef.current;
        if (!canvas) {
          return;
        }
        const rect = canvas.getBoundingClientRect();
        const scaleX = CANVAS_WIDTH / rect.width;
        const scaleY = CANVAS_HEIGHT / rect.height;
        const worldX = (event.clientX - rect.left) * scaleX;
        const worldY = (event.clientY - rect.top) * scaleY;
        onMove(dragIdRef.current, worldX, worldY);
      }}
      onMouseUp={() => {
        dragIdRef.current = null;
      }}
      onMouseLeave={() => {
        dragIdRef.current = null;
      }}
    />
  );
}
