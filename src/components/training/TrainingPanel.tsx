"use client";

import { useEffect, useRef, useState } from "react";
import { SpeedControl } from "@/components/game/SpeedControl";
import { MetricsPanel } from "@/components/training/MetricsPanel";
import { loadDefaultLevel } from "@/game/level/levelLoader";
import { Trainer, type TrainerMetrics } from "@/game/training/Trainer";

const INITIAL_METRICS: TrainerMetrics = {
  episode: 1,
  episodeReward: 0,
  averageReward: 0,
  epsilon: 1,
};

export function TrainingPanel() {
  const trainerRef = useRef<Trainer | null>(null);
  const [running, setRunning] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [metrics, setMetrics] = useState<TrainerMetrics>(INITIAL_METRICS);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      const level = await loadDefaultLevel();
      if (!mounted) {
        return;
      }
      trainerRef.current = new Trainer(level);
      setMetrics(INITIAL_METRICS);
    })();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let raf = 0;
    const frame = () => {
      if (running && trainerRef.current) {
        const next = trainerRef.current.stepMany(speed);
        setMetrics(next);
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [running, speed]);

  return (
    <section style={{ display: "grid", gap: 12 }}>
      <div className="panel" style={{ padding: 12, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <button className="btn" onClick={() => setRunning(true)}>
          Start
        </button>
        <button className="btn" onClick={() => setRunning(false)}>
          Pause
        </button>
        <button
          className="btn"
          onClick={() => {
            trainerRef.current?.reset();
            setMetrics(INITIAL_METRICS);
          }}
        >
          Reset
        </button>
        <SpeedControl value={speed} onChange={setSpeed} />
      </div>
      <MetricsPanel
        episode={metrics.episode}
        episodeReward={metrics.episodeReward}
        averageReward={metrics.averageReward}
        epsilon={metrics.epsilon}
      />
    </section>
  );
}
