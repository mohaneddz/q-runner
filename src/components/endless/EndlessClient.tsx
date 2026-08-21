"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { GameCanvas, type RunOutcome } from "@/components/game/GameCanvas";
import { GameOverlay } from "@/components/game/GameOverlay";
import { MuteButton } from "@/components/ui/MuteButton";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { SiteNav } from "@/components/ui/SiteNav";
import type { Snapshot } from "@/game/core/types";
import { createEndlessStage } from "@/game/generation/endless";
import { generateLevelAsync } from "@/game/generation/generatorClient";
import type { LevelData } from "@/game/level/levelSchema";
import { storageGet, storageSet } from "@/utils/storage";
import { randomSeed } from "@/utils/random";

const BEST_KEY = "endlessBest";
const STATS_STORE = "stats";

interface EndlessBest {
  distance: number;
  stages: number;
  seed: number;
}

export function EndlessClient({ initialSeed }: { initialSeed?: number }) {
  const [runSeed, setRunSeed] = useState<number | null>(initialSeed ?? null);
  const [stage, setStage] = useState(0);
  const [level, setLevel] = useState<LevelData | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [clearedDistance, setClearedDistance] = useState(0);
  const [dead, setDead] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [best, setBest] = useState<EndlessBest | null>(null);
  const [restartToken, setRestartToken] = useState(0);

  // The next stage is built while the current one is being played, so clearing
  // a stage does not drop the player into a loading screen.
  const prefetch = useRef<{ stage: number; promise: Promise<LevelData> } | null>(null);

  useEffect(() => {
    if (initialSeed === undefined) {
      setRunSeed(randomSeed());
    }
  }, [initialSeed]);

  useEffect(() => {
    void storageGet<EndlessBest>(STATS_STORE, BEST_KEY).then(setBest);
  }, []);

  const startStage = useCallback(
    async (seed: number, index: number) => {
      setGenerating(true);
      setError(null);
      try {
        const pending = prefetch.current;
        const promise =
          pending && pending.stage === index
            ? pending.promise
            : generateLevelAsync(createEndlessStage(seed, index).options);
        prefetch.current = null;

        const generated = await promise;
        setLevel(generated);
        setStage(index);
        setDead(false);
        setRestartToken((token) => token + 1);

        // Warm the following stage in the background.
        const next = index + 1;
        prefetch.current = {
          stage: next,
          promise: generateLevelAsync(createEndlessStage(seed, next).options),
        };
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Could not build a stage.");
      } finally {
        setGenerating(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (runSeed === null) {
      return;
    }
    prefetch.current = null;
    setClearedDistance(0);
    void startStage(runSeed, 0);
  }, [runSeed, startStage]);

  const distance = clearedDistance + (snapshot?.progress ?? 0) * (level?.settings.length ?? 0);

  const handleRunEnd = useCallback(
    async (outcome: RunOutcome) => {
      if (!level || runSeed === null) {
        return;
      }

      if (outcome.status === "finished") {
        const total = clearedDistance + level.settings.length;
        setClearedDistance(total);
        void startStage(runSeed, stage + 1);
        return;
      }

      setDead(true);
      const reached = clearedDistance + outcome.progress * level.settings.length;
      if (!best || reached > best.distance) {
        const record: EndlessBest = { distance: reached, stages: stage, seed: runSeed };
        setBest(record);
        await storageSet(STATS_STORE, BEST_KEY, record);
      }
    },
    [best, clearedDistance, level, runSeed, stage, startStage],
  );

  return (
    <main className="appShell stack">
      <SiteNav />

      <div className="panel hud">
        <div className="hudRow">
          <div className="hudTitle">
            <h1 className="hudHeading">Endless</h1>
            <span className="muted">
              Stage {stage + 1}
              {runSeed !== null ? ` · seed ${runSeed}` : ""}
            </span>
          </div>
          <div className="hudStats">
            <span className="muted">{distance.toFixed(0)}u</span>
            {best ? <span className="muted">best {best.distance.toFixed(0)}u</span> : null}
            <MuteButton />
          </div>
        </div>
        <ProgressBar value={snapshot?.progress ?? 0} label="Stage progress" />
      </div>

      <div className="stageWrap">
        {level ? (
          <GameCanvas
            level={level}
            paused={dead || generating}
            autoRestart={false}
            restartToken={restartToken}
            onSnapshot={setSnapshot}
            onRunEnd={(outcome) => void handleRunEnd(outcome)}
          />
        ) : (
          <div className="gameViewport" style={{ display: "grid", placeItems: "center" }}>
            <p className="muted">{error ?? "Building a stage…"}</p>
          </div>
        )}

        {generating && level ? (
          <GameOverlay title="Building the next stage…" detail={<p className="muted">Verifying it can be cleared.</p>} />
        ) : dead ? (
          <GameOverlay
            title="Run over"
            detail={
              <p>
                {distance.toFixed(0)} units across {stage + 1}{" "}
                {stage === 0 ? "stage" : "stages"}.
              </p>
            }
            actions={
              <>
                <button
                  type="button"
                  className="btn btnPrimary"
                  onClick={() => runSeed !== null && void startStage(runSeed, 0)}
                >
                  Retry this seed
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={() => setRunSeed(randomSeed())}
                >
                  New run
                </button>
              </>
            }
          />
        ) : null}
      </div>

      <p className="muted small">
        Each stage is generated on the fly and only accepted once the solver proves it can be
        cleared with human timing. Share a run by adding <code>?seed={runSeed ?? 0}</code> to the
        URL.
      </p>
    </main>
  );
}
