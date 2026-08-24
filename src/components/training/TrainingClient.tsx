"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GameCanvas, type RunOutcome } from "@/components/game/GameCanvas";
import { GameOverlay } from "@/components/game/GameOverlay";
import { LearningChart } from "@/components/training/LearningChart";
import { compact, MetricsPanel } from "@/components/training/MetricsPanel";
import { SiteNav } from "@/components/ui/SiteNav";
import {
  ALGORITHMS,
  createAgent,
  deserializeAgent,
  type AlgorithmId,
  type RLAgent,
  type SerializedAgent,
} from "@/game/training/agent";
import { DEFAULT_DQN_CONFIG, type DQNConfig } from "@/game/training/dqn";
import { AgentInput, createHeuristicPolicy } from "@/game/input/AgentInput";
import { BUILTIN_LEVELS, loadBuiltinLevel } from "@/game/level/builtinLevels";
import type { LevelData } from "@/game/level/levelSchema";
import { Trainer, type TrainerMetrics } from "@/game/training/Trainer";
import { DEFAULT_CONFIG, type QLearningConfig } from "@/game/training/qlearning";
import { storageGet, storageSet } from "@/utils/storage";

const AGENT_STORE = "agents";
const CHART_SAMPLES = 240;
/** Milliseconds of each animation frame handed to the trainer. */
const BUDGET_STEPS = [1, 2, 4, 8, 12] as const;
/** Bounds memory: each checkpoint clones the whole agent (Q-table or network weights). */
const CHECKPOINT_LIMIT = 20;
const DEFAULT_CHECKPOINT_INTERVAL = 500;

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

const ALGORITHM_BLURB: Record<AlgorithmId, string> = {
  qlearning:
    "A tabular Q-learning agent playing the same engine you do. It sees the distance to the " +
    "next hazard, the gap ahead, its own velocity and the clearance overhead — and has one " +
    "choice per tick: hold or release. Its Q-values live in a lookup table, one row per " +
    "discretized state.",
  dqn:
    "A DQN agent playing the same engine you do, over the same observation but as scaled " +
    "continuous inputs rather than discretized buckets. A small hand-rolled neural net " +
    "approximates Q-values instead of a lookup table, trained off a replay buffer against a " +
    "periodically-synced target network.",
};

interface Checkpoint {
  episode: number;
  agent: SerializedAgent;
  averageProgress: number;
  completionRate: number;
  stateCount: number;
}

/** Source the watch panel plays back: the trainer's live agent, or a frozen checkpoint. */
type WatchSource = "live" | number;

export function TrainingClient() {
  const [levelId, setLevelId] = useState(BUILTIN_LEVELS[0]?.id ?? "level01");
  const [algorithm, setAlgorithm] = useState<AlgorithmId>("qlearning");
  const [level, setLevel] = useState<LevelData | null>(null);
  const [running, setRunning] = useState(false);
  const [budgetIndex, setBudgetIndex] = useState(2);
  const [metrics, setMetrics] = useState<TrainerMetrics>(INITIAL_METRICS);
  const [watching, setWatching] = useState(false);
  const [saveNote, setSaveNote] = useState<string | null>(null);
  const [progressSeries, setProgressSeries] = useState<number[]>([]);
  const [clearSeries, setClearSeries] = useState<number[]>([]);
  const [qParams, setQParams] = useState<QLearningConfig>(DEFAULT_CONFIG);
  const [dqnParams, setDqnParams] = useState<DQNConfig>(DEFAULT_DQN_CONFIG);
  const [checkpointInterval, setCheckpointInterval] = useState(DEFAULT_CHECKPOINT_INTERVAL);
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [watchSource, setWatchSource] = useState<WatchSource>("live");
  const [watchRestartToken, setWatchRestartToken] = useState(0);
  const [watchFinished, setWatchFinished] = useState(false);

  const trainerRef = useRef<Trainer<RLAgent> | null>(null);
  const runningRef = useRef(false);
  const budgetRef = useRef<number>(BUDGET_STEPS[2]);
  const checkpointIntervalRef = useRef(DEFAULT_CHECKPOINT_INTERVAL);
  const lastCheckpointMarkRef = useRef(0);
  const checkpointsRef = useRef<Checkpoint[]>([]);
  const watchSourceRef = useRef<WatchSource>("live");
  const checkpointAgentCache = useRef<Map<number, RLAgent>>(new Map());

  useEffect(() => {
    runningRef.current = running;
    budgetRef.current = BUDGET_STEPS[budgetIndex];
    checkpointIntervalRef.current = checkpointInterval;
  }, [running, budgetIndex, checkpointInterval]);

  useEffect(() => {
    checkpointsRef.current = checkpoints;
  }, [checkpoints]);

  useEffect(() => {
    watchSourceRef.current = watchSource;
  }, [watchSource]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const loaded = await loadBuiltinLevel(levelId);
      if (cancelled || !loaded) {
        return;
      }
      const storeKey = `${levelId}:${algorithm}`;
      const stored = await storageGet<SerializedAgent>(AGENT_STORE, storeKey);
      if (cancelled) {
        return;
      }

      const trainer = new Trainer(loaded, createAgent(algorithm));
      if (stored) {
        trainer.loadAgent(stored);
      }
      trainerRef.current = trainer;
      setLevel(loaded);
      setMetrics(trainer.getMetrics());
      setProgressSeries([]);
      setClearSeries([]);
      setSaveNote(stored ? "Loaded a saved agent for this level." : null);

      const agent = trainer.getAgent();
      if (agent.algorithm === "qlearning") {
        setQParams(agent.getConfig());
      } else {
        setDqnParams(agent.getConfig());
      }

      setCheckpoints([]);
      lastCheckpointMarkRef.current = 0;
      checkpointAgentCache.current.clear();
      setWatchSource("live");
      setWatchFinished(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [levelId, algorithm]);

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

        // Checked on the same throttle as the chart sample rather than every
        // frame — at high steps/sec a naive per-frame check could cross a
        // checkpoint boundary dozens of times a second.
        const interval = checkpointIntervalRef.current;
        if (interval > 0) {
          const mark = Math.floor(next.episode / interval);
          if (mark > lastCheckpointMarkRef.current) {
            lastCheckpointMarkRef.current = mark;
            const episode = mark * interval;
            const checkpoint: Checkpoint = {
              episode,
              agent: trainer.getAgent().serialize(),
              averageProgress: next.averageProgress,
              completionRate: next.completionRate,
              stateCount: next.stateCount,
            };
            setCheckpoints((list) =>
              [...list.filter((entry) => entry.episode !== episode), checkpoint]
                .sort((a, b) => a.episode - b.episode)
                .slice(-CHECKPOINT_LIMIT),
            );
          }
        }
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
    await storageSet(AGENT_STORE, `${levelId}:${algorithm}`, trainer.getAgent().serialize());
    setSaveNote(`Saved ${trainer.getAgent().stateCount} states.`);
  }, [levelId, algorithm]);

  const updateQParam = useCallback((key: keyof QLearningConfig, value: number) => {
    if (Number.isNaN(value)) {
      return;
    }
    setQParams((prev) => ({ ...prev, [key]: value }));
    const agent = trainerRef.current?.getAgent();
    if (agent?.algorithm === "qlearning") {
      agent.configure({ [key]: value });
    }
  }, []);

  const updateDqnParam = useCallback((key: keyof DQNConfig, value: number) => {
    if (Number.isNaN(value)) {
      return;
    }
    setDqnParams((prev) => ({ ...prev, [key]: value }));
    const agent = trainerRef.current?.getAgent();
    if (agent?.algorithm === "dqn") {
      agent.configure({ [key]: value });
    }
  }, []);

  const getCheckpointAgent = useCallback((episode: number): RLAgent | null => {
    const cached = checkpointAgentCache.current.get(episode);
    if (cached) {
      return cached;
    }
    const record = checkpointsRef.current.find((entry) => entry.episode === episode);
    if (!record) {
      return null;
    }
    const agent = deserializeAgent(record.agent);
    checkpointAgentCache.current.set(episode, agent);
    return agent;
  }, []);

  // One provider for the page's lifetime, so starting a watch run never
  // rebuilds the engine. Its policy is swapped in after mount rather than
  // reading the trainer ref while rendering.
  const [watchInput] = useState<AgentInput>(() => new AgentInput(() => 0));
  const fallbackPolicy = useMemo(() => createHeuristicPolicy(), []);

  useEffect(() => {
    watchInput.setPolicy((observation) => {
      const source = watchSourceRef.current;
      if (source !== "live") {
        const agent = getCheckpointAgent(source);
        if (agent) {
          return agent.getGreedyAction(observation);
        }
      }
      const trainer = trainerRef.current;
      if (!trainer || trainer.getAgent().stateCount === 0) {
        return fallbackPolicy(observation);
      }
      return trainer.getAgent().getGreedyAction(observation);
    });
  }, [watchInput, fallbackPolicy, getCheckpointAgent]);

  const selectWatchSource = useCallback((source: WatchSource) => {
    setWatchSource(source);
    setWatchFinished(false);
    setWatchRestartToken((token) => token + 1);
    setWatching(true);
  }, []);

  const handleWatchRunEnd = useCallback((outcome: RunOutcome) => {
    setWatchFinished(outcome.status === "finished");
  }, []);

  const replayWatch = useCallback(() => {
    setWatchFinished(false);
    setWatchRestartToken((token) => token + 1);
  }, []);

  const restartWatchNext = useCallback(() => {
    const sorted = checkpointsRef.current;
    const current = watchSourceRef.current;
    let next: WatchSource = "live";

    if (current === "live") {
      next = sorted.length > 0 ? sorted[0].episode : "live";
    } else {
      const index = sorted.findIndex((entry) => entry.episode === current);
      next = index >= 0 && index + 1 < sorted.length ? sorted[index + 1].episode : "live";
    }

    setWatchSource(next);
    setWatchFinished(false);
    setWatchRestartToken((token) => token + 1);
  }, []);

  return (
    <main className="appShell stack">
      <SiteNav />

      <div className="sectionHead">
        <h1>Training</h1>
        <div className="toolRowActions">
          <label className="field" style={{ minWidth: 190 }}>
            Algorithm
            <select
              value={algorithm}
              onChange={(event) => {
                setRunning(false);
                setWatching(false);
                setAlgorithm(event.target.value as AlgorithmId);
              }}
            >
              {ALGORITHMS.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.label}
                </option>
              ))}
            </select>
          </label>
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
      </div>

      <p className="muted">{ALGORITHM_BLURB[algorithm]}</p>

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
                  setCheckpoints([]);
                  lastCheckpointMarkRef.current = 0;
                  checkpointAgentCache.current.clear();
                  setWatchSource("live");
                  setWatchFinished(false);
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

          <MetricsPanel
            metrics={metrics}
            stateLabel={algorithm === "dqn" ? "Buffered transitions" : "States seen"}
          />

          <div className="panel pad stack">
            <h2>Hyperparameters</h2>
            {algorithm === "qlearning" ? (
              <div className="fieldGrid">
                <label className="field">
                  Learning rate (α)
                  <input
                    type="number"
                    className="input"
                    min={0.01}
                    max={1}
                    step={0.01}
                    value={qParams.alpha}
                    onChange={(event) => updateQParam("alpha", Number(event.target.value))}
                  />
                </label>
                <label className="field">
                  Discount (γ)
                  <input
                    type="number"
                    className="input"
                    min={0}
                    max={0.999}
                    step={0.001}
                    value={qParams.gamma}
                    onChange={(event) => updateQParam("gamma", Number(event.target.value))}
                  />
                </label>
                <label className="field">
                  Epsilon decay
                  <input
                    type="number"
                    className="input"
                    min={0.9}
                    max={1}
                    step={0.000001}
                    value={qParams.epsilonDecay}
                    onChange={(event) => updateQParam("epsilonDecay", Number(event.target.value))}
                  />
                </label>
                <label className="field">
                  Epsilon floor
                  <input
                    type="number"
                    className="input"
                    min={0}
                    max={1}
                    step={0.001}
                    value={qParams.epsilonMin}
                    onChange={(event) => updateQParam("epsilonMin", Number(event.target.value))}
                  />
                </label>
              </div>
            ) : (
              <div className="fieldGrid">
                <label className="field">
                  Learning rate
                  <input
                    type="number"
                    className="input"
                    min={0.0001}
                    max={1}
                    step={0.0001}
                    value={dqnParams.learningRate}
                    onChange={(event) => updateDqnParam("learningRate", Number(event.target.value))}
                  />
                </label>
                <label className="field">
                  Discount (γ)
                  <input
                    type="number"
                    className="input"
                    min={0}
                    max={0.999}
                    step={0.001}
                    value={dqnParams.gamma}
                    onChange={(event) => updateDqnParam("gamma", Number(event.target.value))}
                  />
                </label>
                <label className="field">
                  Epsilon decay
                  <input
                    type="number"
                    className="input"
                    min={0.9}
                    max={1}
                    step={0.000001}
                    value={dqnParams.epsilonDecay}
                    onChange={(event) => updateDqnParam("epsilonDecay", Number(event.target.value))}
                  />
                </label>
                <label className="field">
                  Epsilon floor
                  <input
                    type="number"
                    className="input"
                    min={0}
                    max={1}
                    step={0.001}
                    value={dqnParams.epsilonMin}
                    onChange={(event) => updateDqnParam("epsilonMin", Number(event.target.value))}
                  />
                </label>
                <label className="field">
                  Batch size
                  <input
                    type="number"
                    className="input"
                    min={1}
                    max={256}
                    step={1}
                    value={dqnParams.batchSize}
                    onChange={(event) => updateDqnParam("batchSize", Number(event.target.value))}
                  />
                </label>
                <label className="field">
                  Target sync interval
                  <input
                    type="number"
                    className="input"
                    min={10}
                    max={10000}
                    step={10}
                    value={dqnParams.targetUpdateInterval}
                    onChange={(event) =>
                      updateDqnParam("targetUpdateInterval", Number(event.target.value))
                    }
                  />
                </label>
              </div>
            )}
            <p className="muted small">
              Applied live to the running agent — no reset needed. Reset agent restores the table
              or network to empty but keeps these values.
            </p>
          </div>

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
            {watching ? (
              <p className="muted small">
                Watching:{" "}
                {watchSource === "live" ? "live agent" : `checkpoint @ episode ${compact(watchSource)}`}
              </p>
            ) : null}
            <button
              type="button"
              className={`btn ${watching ? "" : "btnPrimary"}`}
              onClick={() =>
                setWatching((value) => {
                  const next = !value;
                  if (next) {
                    setWatchFinished(false);
                    setWatchRestartToken((token) => token + 1);
                  }
                  return next;
                })
              }
              disabled={!level}
            >
              {watching ? "Stop" : "Watch"}
            </button>
          </div>

          {watching && level ? (
            <div className="stageWrap">
              <GameCanvas
                level={level}
                input={watchInput}
                restartToken={watchRestartToken}
                onSnapshot={() => {}}
                onRunEnd={handleWatchRunEnd}
              />
              {watchFinished ? (
                <GameOverlay
                  tone="win"
                  title="Cleared!"
                  detail={
                    <p>
                      {watchSource === "live" ? "The live agent" : `Checkpoint @ episode ${compact(watchSource)}`}{" "}
                      finished the level.
                    </p>
                  }
                  actions={
                    <>
                      <button type="button" className="btn btnPrimary" onClick={replayWatch}>
                        Replay
                      </button>
                      <button
                        type="button"
                        className="btn"
                        onClick={restartWatchNext}
                        title="Jump to the next checkpoint"
                      >
                        Restart
                      </button>
                    </>
                  }
                />
              ) : null}
            </div>
          ) : null}

          <div className="panel pad stack">
            <div className="toolRow">
              <h2>Checkpoints</h2>
              <label className="field" style={{ minWidth: 150 }}>
                Snapshot every
                <input
                  type="number"
                  className="input"
                  min={50}
                  step={50}
                  value={checkpointInterval}
                  onChange={(event) =>
                    setCheckpointInterval(Math.max(50, Number(event.target.value) || 50))
                  }
                />
              </label>
            </div>
            <p className="muted small">
              A frozen copy of the agent every {checkpointInterval} episodes, newest{" "}
              {CHECKPOINT_LIMIT} kept. Pick one to watch it play, or step through them with Restart
              after a win.
            </p>
            <div className="checkpointList">
              <button
                type="button"
                className={`checkpointRow ${watchSource === "live" ? "checkpointRowActive" : ""}`}
                onClick={() => selectWatchSource("live")}
              >
                <span>Live</span>
                <span className="muted small">current agent</span>
              </button>
              {checkpoints.length === 0 ? (
                <p className="muted small">No checkpoints yet — start training to collect some.</p>
              ) : (
                [...checkpoints]
                  .reverse()
                  .map((checkpoint) => (
                    <button
                      key={checkpoint.episode}
                      type="button"
                      className={`checkpointRow ${
                        watchSource === checkpoint.episode ? "checkpointRowActive" : ""
                      }`}
                      onClick={() => selectWatchSource(checkpoint.episode)}
                    >
                      <span>Ep {compact(checkpoint.episode)}</span>
                      <span className="muted small">
                        {(checkpoint.averageProgress * 100).toFixed(0)}% progress ·{" "}
                        {(checkpoint.completionRate * 100).toFixed(0)}% clear ·{" "}
                        {compact(checkpoint.stateCount)}
                      </span>
                    </button>
                  ))
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
