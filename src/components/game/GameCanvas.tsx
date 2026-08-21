"use client";

import { useEffect, useRef } from "react";
import { CANVAS_HEIGHT, CANVAS_WIDTH, FIXED_DT } from "@/game/core/constants";
import { GameEngine } from "@/game/core/GameEngine";
import { GameLoop } from "@/game/core/GameLoop";
import type { InputProvider, RunStatus, Snapshot } from "@/game/core/types";
import { audio } from "@/game/audio/audioManager";
import { HumanInput } from "@/game/input/HumanInput";
import type { LevelData } from "@/game/level/levelSchema";
import { CanvasRenderer } from "@/game/render/CanvasRenderer";

export interface RunOutcome {
  status: RunStatus;
  progress: number;
  ticks: number;
  attempt: number;
}

interface GameCanvasProps {
  level: LevelData;
  /** Omit for keyboard/pointer control; supply one to watch an agent play. */
  input?: InputProvider;
  paused?: boolean;
  autoRestart?: boolean;
  /** Change this to force a restart without rebuilding the engine's inputs. */
  restartToken?: number;
  onSnapshot?: (snapshot: Snapshot) => void;
  onRunEnd?: (outcome: RunOutcome) => void;
}

/** HUD refresh rate. Pushing every frame into React state re-renders at 60Hz. */
const SNAPSHOT_INTERVAL_MS = 90;
/** How long the wreck stays on screen before the next attempt starts. */
const DEATH_PAUSE_SECONDS = 0.55;

export function GameCanvas({
  level,
  input,
  paused = false,
  autoRestart = true,
  restartToken = 0,
  onSnapshot,
  onRunEnd,
}: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Callbacks and flags go through refs so changing them never tears down the
  // engine. The previous version listed them as effect dependencies, and since
  // onSnapshot fired every frame the effect re-ran every frame, restarting the
  // level continuously.
  const onSnapshotRef = useRef(onSnapshot);
  const onRunEndRef = useRef(onRunEnd);
  const pausedRef = useRef(paused);
  const autoRestartRef = useRef(autoRestart);

  useEffect(() => {
    onSnapshotRef.current = onSnapshot;
    onRunEndRef.current = onRunEnd;
    pausedRef.current = paused;
    autoRestartRef.current = autoRestart;
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) {
      return;
    }

    const humanInput = input ? null : new HumanInput();
    humanInput?.bind(container);

    const engine = new GameEngine(level, input ?? humanInput!);
    const renderer = new CanvasRenderer(canvas);

    const applySize = () => {
      const rect = container.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        renderer.resize(rect.width, rect.height, window.devicePixelRatio || 1);
      }
    };
    applySize();
    const observer = new ResizeObserver(applySize);
    observer.observe(container);

    let lastPublish = 0;
    let deathTimer = 0;
    let reported = false;

    const loop = new GameLoop(
      FIXED_DT,
      () => {
        if (pausedRef.current) {
          return;
        }

        if (engine.getStatus() !== "running") {
          deathTimer -= FIXED_DT;
          if (deathTimer <= 0 && autoRestartRef.current && engine.getStatus() === "dead") {
            renderer.resetEffects();
            engine.reset();
            reported = false;
          }
          return;
        }

        const result = engine.step();

        if (result.events.jumped) {
          audio.play("jump", 0.35);
        }
        if (result.events.orbHit || result.events.padHit) {
          audio.play("orb", 0.5);
        }
        if (result.events.portalHit) {
          audio.play("portal", 0.5);
        }

        if (result.done && !reported) {
          reported = true;
          deathTimer = DEATH_PAUSE_SECONDS;
          if (result.status === "dead") {
            audio.play("death", 0.5);
          }
          const snapshot = engine.getSnapshot();
          onRunEndRef.current?.({
            status: result.status,
            progress: snapshot.progress,
            ticks: snapshot.tick,
            attempt: snapshot.attempt,
          });
        }
      },
      (frameDelta) => {
        const snapshot = engine.getSnapshot();
        renderer.render(snapshot, frameDelta);

        const now = performance.now();
        if (now - lastPublish >= SNAPSHOT_INTERVAL_MS) {
          lastPublish = now;
          onSnapshotRef.current?.(snapshot);
        }
      },
    );

    loop.start();

    return () => {
      loop.stop();
      observer.disconnect();
      humanInput?.unbind();
    };
  }, [level, input, restartToken]);

  return (
    <div
      ref={containerRef}
      className="gameViewport"
      style={{ aspectRatio: `${CANVAS_WIDTH} / ${CANVAS_HEIGHT}` }}
      onPointerDown={() => audio.unlock()}
    >
      <canvas ref={canvasRef} className="gameCanvas" />
    </div>
  );
}
