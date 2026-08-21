"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GameCanvas } from "@/components/game/GameCanvas";
import { LearningChart } from "@/components/training/LearningChart";
import { MetricsPanel } from "@/components/training/MetricsPanel";
import { SiteNav } from "@/components/ui/SiteNav";
import { AgentInput, createHeuristicPolicy } from "@/game/input/AgentInput";
import { BUILTIN_LEVELS, loadBuiltinLevel } from "@/game/level/builtinLevels";
import type { LevelData } from "@/game/level/levelSchema";
import { Trainer, type TrainerMetrics } from "@/game/training/Trainer";
import type { SerializedAgent } from "@/game/training/qlearning";
import { storageGet, storageSet } from "@/utils/storage";

const AGENT_STORE = "agents";
const CHART_SAMPLES = 240;
/** Milliseconds of each animation frame handed to the trainer. */
const BUDGET_STEPS = [1, 2, 4, 8, 12] as const;

const INITIAL_METRICS: TrainerMetrics = {
  episode: 1,
  totalSteps: 0,
  episodeReward: 0,
  averageReward: 0,
  bestProgress: 0,
  averageProgress: 0,
  completionRate: 0,
  epsilon: 1,
  stateCount: 0,
  stepsPerSecond: 0,
};

export function TrainingClient() {
  const [levelId, setLevelId] = useState(BUILTIN_LEVELS[0]?.id ?? "level01");
  const [level, setLevel] = useState<LevelData | null>(null);
  const [running, setRunning] = useState(false);
  const [budgetIndex, setBudgetIndex] = useState(2);
  const [metrics, setMetrics] = useState<TrainerMetrics>(INITIAL_METRICS);
  const [watching, setWatching] = useState(false);
  const [saveNote, setSaveNote] = useState<string | null>(null);
  const [progressSeries, setProgressSeries] = useState<number[]>([]);
  const [clearSeries, setClearSeries] = useState<number[]>([]);

  const trainerRef = useRef<Trainer | null>(null);
  const runningRef = useRef(false);
  const budgetRef = useRef<number>(BUDGET_STEPS[2]);

  useEffect(() => {
    runningRef.current = running;
    budgetRef.current = BUDGET_STEPS[budgetIndex];
  }, [running, budgetIndex]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const loaded = await loadBuiltinLevel(levelId);
      if (cancelled || !loaded) {
        return;
      }
      const stored = await storageGet<SerializedAgent>(AGENT_STORE, levelId);
      if (cancelled) {
        return;
      }

      const trainer = new Trainer(loaded);
      if (stored) {
        trainer.loadAgent(stored);
      }
      trainerRef.current = trainer;
      setLevel(loaded);
      setMetrics(trainer.getMetrics());
      setProgressSeries([]);
      setClearSeries([]);
      setSaveNote(stored ? "Loaded a saved agent for this level." : null);
    })();

    return () => {
      cancelled = true;
    };
  }, [levelId]);

  // One rAF loop for the lifetime of the page; it no-ops while paused so
  // toggling Start does not churn effects.
  useEffect(() => {
    let raf = 0;
    let lastSample = 0;

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const trainer = trainerRef.current;
      if (!runningRef.current || !trainer) {
        return;
      }

      const next = trainer.runFor(budgetRef.current);
      setMetrics(next);

      if (now - lastSample >= 500) {
        lastSample = now;
        setProgressSeries((series) => [...series, next.averageProgress].slice(-CHART_SAMPLES));
        setClearSeries((series) => [...series, next.completionRate].slice(-CHART_SAMPLES));
      }
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  const saveAgent = useCallback(async () => {
    const trainer = trainerRef.current;
    if (!trainer) {
      return;
    }
    await storageSet(AGENT_STORE, levelId, trainer.getAgent().serialize());
    setSaveNote(`Saved ${trainer.getAgent().stateCount} states.`);
  }, [levelId]);

  // One provider for the page's lifetime, so starting a watch run never
  // rebuilds the engine. Its policy is swapped in after mount rather than
  // reading the trainer ref while rendering.
  const [watchInput] = useState<AgentInput>(() => new AgentInput(() => 0));
  const fallbackPolicy = useMemo(() => createHeuristicPolicy(), []);

  useEffect(() => {
    watchInput.setPolicy((observation) => {
      const trainer = trainerRef.current;
      if (!trainer || trainer.getAgent().stateCount === 0) {
        return fallbackPolicy(observation);
      }
      return trainer.getAgent().getGreedyAction(observation);
    });
  }, [watchInput, fallbackPolicy]);

  return (
    <main className="appShell stack">
      <SiteNav />

      <div className="sectionHead">
        <h1>Training</h1>
        <label className="field" style={{ minWidth: 200 }}>
          Level
          <select
            value={levelId}
            onChange={(event) => {
              // Stop here rather than in the load effect — switching level is a
              // user action, and pausing is the response to it.
              setRunning(false);
              setWatching(false);
              setLevelId(event.target.value);
            }}
          >
            {BUILTIN_LEVELS.map((summary) => (
              <option key={summary.id} value={summary.id}>
                {String(summary.tier).padStart(2, "0")} · {summary.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <p className="muted">
        A tabular Q-learning agent playing the same engine you do. It sees the distance to the
        next hazard, the gap ahead, its own velocity and the clearance overhead — and has one
        choice per tick: hold or release.
      </p>

      <div className="trainingLayout">
        <div className="stack">
          <div className="panel pad toolRow">
            <div className="toolRowActions">
              <button
                type="button"
                className={`btn ${running ? "" : "btnPrimary"}`}
                onClick={() => setRunning((value) => !value)}
                disabled={!level}
              >
                {running ? "Pause" : "Start training"}
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  trainerRef.current?.reset();
                  setMetrics(trainerRef.current?.getMetrics() ?? INITIAL_METRICS);
                  setProgressSeries([]);
                  setClearSeries([]);
                  setSaveNote(null);
                }}
              >
                Reset agent
              </button>
              <button type="button" className="btn" onClick={() => void saveAgent()}>
                Save agent
              </button>
            </div>

            <label className="sliderRow" style={{ minWidth: 200 }}>
              <input
                type="range"
                min={0}
                max={BUDGET_STEPS.length - 1}
                step={1}
                value={budgetIndex}
                onChange={(event) => setBudgetIndex(Number(event.target.value))}
                aria-label="Training effort per frame"
              />
              <strong>{BUDGET_STEPS[budgetIndex]}ms/frame</strong>
            </label>
          </div>

          {saveNote ? (
            <p className="muted small" role="status">
              {saveNote}
            </p>
          ) : null}

          <MetricsPanel metrics={metrics} />

          <LearningChart
            series={[
              { label: "Avg progress", color: "#20f1ff", points: progressSeries },
              { label: "Clear rate", color: "#81ff6f", points: clearSeries },
            ]}
          />
        </div>

        <div className="stack">
          <div className="panel pad stack">
            <h2>Watch the agent</h2>
            <p className="muted small">
              Runs the greedy policy with no exploration. Before any training it falls back to
              the hand-written baseline.
            </p>
            <button
              type="button"
              className={`btn ${watching ? "" : "btnPrimary"}`}
              onClick={() => setWatching((value) => !value)}
              disabled={!level}
            >
              {watching ? "Stop" : "Watch"}
            </button>
          </div>

          {watching && level ? (
            <GameCanvas level={level} input={watchInput} onSnapshot={() => {}} />
          ) : null}
        </div>
      </div>
    </main>
  );
}
