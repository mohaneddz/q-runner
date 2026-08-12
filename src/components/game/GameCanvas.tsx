"use client";

import { useEffect, useRef } from "react";
import { CANVAS_HEIGHT, CANVAS_WIDTH, FIXED_DT } from "@/game/core/constants";
import { GameEngine } from "@/game/core/GameEngine";
import { GameLoop } from "@/game/core/GameLoop";
import type { Snapshot } from "@/game/core/types";
import { AgentInput, createHeuristicPolicy } from "@/game/input/AgentInput";
import { HumanInput } from "@/game/input/HumanInput";
import { loadLevelOrDefault } from "@/game/level/levelStore";
import { CanvasRenderer } from "@/game/render/CanvasRenderer";

interface GameCanvasProps {
  mode: "human" | "agent";
  levelId?: string;
  onSnapshot: (snapshot: Snapshot) => void;
  onDeath: () => void;
}

export function GameCanvas({ mode, levelId, onSnapshot, onDeath }: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    let disposed = false;
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    let loop: GameLoop | null = null;
    let humanInput: HumanInput | null = null;

    void (async () => {
      const level = await loadLevelOrDefault(levelId);
      if (disposed) {
        return;
      }

      const input = mode === "human" ? new HumanInput() : new AgentInput(createHeuristicPolicy());
      if (input instanceof HumanInput) {
        humanInput = input;
        humanInput.bind(window);
      }

      const engine = new GameEngine(level, input);
      const renderer = new CanvasRenderer(canvas);

      loop = new GameLoop(
        FIXED_DT,
        () => {
          const result = engine.step();
          if (result.status === "dead") {
            onDeath();
            engine.reset();
          }
        },
        () => {
          const snapshot = engine.getSnapshot();
          renderer.render(snapshot);
          onSnapshot(snapshot);
        },
      );
      loop.start();
    })();

    return () => {
      disposed = true;
      loop?.stop();
      humanInput?.unbind();
    };
  }, [mode, levelId, onDeath, onSnapshot]);

  return (
    <canvas
      ref={canvasRef}
      width={CANVAS_WIDTH}
      height={CANVAS_HEIGHT}
      style={{
        width: "100%",
        maxWidth: 1100,
        aspectRatio: `${CANVAS_WIDTH} / ${CANVAS_HEIGHT}`,
        borderRadius: 12,
        border: "1px solid rgba(255,255,255,0.15)",
      }}
    />
  );
}
