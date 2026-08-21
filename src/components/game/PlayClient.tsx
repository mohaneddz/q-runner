"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { GameCanvas, type RunOutcome } from "@/components/game/GameCanvas";
import { GameHud } from "@/components/game/GameHud";
import { GameOverlay } from "@/components/game/GameOverlay";
import { SiteNav } from "@/components/ui/SiteNav";
import type { InputProvider, Snapshot } from "@/game/core/types";
import { AgentInput, createHeuristicPolicy, ReplayInput } from "@/game/input/AgentInput";
import { FIRST_LEVEL_ID, nextLevelId, summaryFor } from "@/game/level/builtinLevels";
import type { LevelData } from "@/game/level/levelSchema";
import { loadLevelById } from "@/game/level/levelStore";
import { loadProgress, recordAttempt } from "@/game/level/progressStore";
import { solveLevelAsync } from "@/game/validation/solverClient";

type WatchMode = "play" | "heuristic" | "solution";

interface PlayClientProps {
  levelId?: string;
}

export function PlayClient({ levelId }: PlayClientProps) {
  const targetId = levelId ?? FIRST_LEVEL_ID;

  const [level, setLevel] = useState<LevelData | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "missing">("loading");
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [watchMode, setWatchMode] = useState<WatchMode>("play");
  const [paused, setPaused] = useState(false);
  const [restartToken, setRestartToken] = useState(0);
  const [attempts, setAttempts] = useState(1);
  const [bestProgress, setBestProgress] = useState(0);
  const [finished, setFinished] = useState(false);
  const [solution, setSolution] = useState<boolean[] | null>(null);
  const [solving, setSolving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoadState("loading");
    setLevel(null);
    setSolution(null);
    setWatchMode("play");
    setFinished(false);

    void (async () => {
      const [loaded, progress] = await Promise.all([
        loadLevelById(targetId),
        loadProgress(targetId),
      ]);
      if (cancelled) {
        return;
      }
      if (!loaded) {
        setLoadState("missing");
        return;
      }
      setLevel(loaded);
      setBestProgress(progress.bestProgress);
      setAttempts(1);
      setLoadState("ready");
    })();

    return () => {
      cancelled = true;
    };
  }, [targetId]);

  const restart = useCallback(() => {
    setFinished(false);
    setPaused(false);
    setRestartToken((token) => token + 1);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) {
        return;
      }
      if (event.code === "KeyR") {
        restart();
      }
      if (event.code === "KeyP" || event.code === "Escape") {
        setPaused((value) => !value);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [restart]);

  // Rebuilding this would tear down the engine, so it must stay referentially
  // stable for as long as the chosen mode does.
  const input = useMemo<InputProvider | undefined>(() => {
    if (watchMode === "heuristic") {
      return new AgentInput(createHeuristicPolicy());
    }
    if (watchMode === "solution" && solution) {
      return new ReplayInput(solution);
    }
    return undefined;
  }, [watchMode, solution]);

  const watchSolution = useCallback(async () => {
    if (!level || solving) {
      return;
    }
    if (solution) {
      setWatchMode("solution");
      restart();
      return;
    }
    setSolving(true);
    try {
      const result = await solveLevelAsync(level, true);
      if (result.solvable && result.path) {
        setSolution(result.path);
        setWatchMode("solution");
        restart();
      }
    } finally {
      setSolving(false);
    }
  }, [level, solution, solving, restart]);

  const handleRunEnd = useCallback(
    (outcome: RunOutcome) => {
      setAttempts(outcome.attempt + (outcome.status === "dead" ? 1 : 0));
      setBestProgress((current) => Math.max(current, outcome.progress));

      if (outcome.status === "finished") {
        setFinished(true);
      }

      // Only human runs count towards a player's record.
      if (watchMode === "play") {
        void recordAttempt(targetId, {
          progress: outcome.progress,
          completed: outcome.status === "finished",
          ticks: outcome.ticks,
        });
      }
    },
    [targetId, watchMode],
  );

  if (loadState === "loading") {
    return (
      <main className="appShell stack">
        <SiteNav />
        <p className="muted">Loading level…</p>
      </main>
    );
  }

  if (loadState === "missing" || !level) {
    return (
      <main className="appShell stack">
        <SiteNav />
        <div className="panel pad">
          <h1>Level not found</h1>
          <p className="muted">
            No level is stored under <code>{targetId}</code>.
          </p>
          <Link href="/levels" className="btn">
            Browse levels
          </Link>
        </div>
      </main>
    );
  }

  const followUp = nextLevelId(targetId);
  const summary = summaryFor(targetId);

  return (
    <main className="appShell stack">
      <SiteNav />

      <GameHud
        level={level}
        snapshot={snapshot}
        attempts={attempts}
        bestProgress={bestProgress}
      />

      <div className="stageWrap">
        <GameCanvas
          level={level}
          input={input}
          paused={paused || finished}
          restartToken={restartToken}
          onSnapshot={setSnapshot}
          onRunEnd={handleRunEnd}
        />

        {finished ? (
          <GameOverlay
            tone="win"
            title="Level complete"
            detail={
              <p>
                Cleared in {attempts} {attempts === 1 ? "attempt" : "attempts"}.
              </p>
            }
            actions={
              <>
                <button type="button" className="btn" onClick={restart}>
                  Play again
                </button>
                {followUp ? (
                  <Link href={`/play?level=${followUp}`} className="btn btnPrimary">
                    Next level
                  </Link>
                ) : null}
                <Link href="/levels" className="btn">
                  All levels
                </Link>
              </>
            }
          />
        ) : paused ? (
          <GameOverlay
            title="Paused"
            detail={<p className="muted">Press P or Escape to resume.</p>}
            actions={
              <button type="button" className="btn btnPrimary" onClick={() => setPaused(false)}>
                Resume
              </button>
            }
          />
        ) : null}
      </div>

      <div className="panel pad toolRow">
        <span className="muted">
          Hold <kbd>Space</kbd> or click to jump · <kbd>R</kbd> restart · <kbd>P</kbd> pause
        </span>
        <div className="toolRowActions">
          <button
            type="button"
            className={`btn ${watchMode === "play" ? "btnPrimary" : ""}`}
            onClick={() => {
              setWatchMode("play");
              restart();
            }}
          >
            Play
          </button>
          <button
            type="button"
            className={`btn ${watchMode === "heuristic" ? "btnPrimary" : ""}`}
            onClick={() => {
              setWatchMode("heuristic");
              restart();
            }}
          >
            Watch bot
          </button>
          <button
            type="button"
            className={`btn ${watchMode === "solution" ? "btnPrimary" : ""}`}
            onClick={() => void watchSolution()}
            disabled={solving}
          >
            {solving ? "Solving…" : "Watch solution"}
          </button>
        </div>
      </div>

      {summary ? (
        <p className="muted small">
          {summary.length.toFixed(0)} units · speed {summary.baseSpeed} · modes{" "}
          {summary.modes.join(", ")}
          {summary.hasGravityFlips ? " · gravity flips" : ""}
        </p>
      ) : null}
    </main>
  );
}
