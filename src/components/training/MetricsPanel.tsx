import type { TrainerMetrics } from "@/game/training/Trainer";

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <div className="metricLabel">{label}</div>
      <div className="metricValue">{value}</div>
    </div>
  );
}

function compact(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}k`;
  }
  return value.toFixed(0);
}

export function MetricsPanel({ metrics }: { metrics: TrainerMetrics }) {
  return (
    <div className="metricGrid">
      <Metric label="Episodes" value={compact(metrics.episode)} />
      <Metric label="Steps" value={compact(metrics.totalSteps)} />
      <Metric label="Avg progress" value={`${(metrics.averageProgress * 100).toFixed(1)}%`} />
      <Metric label="Best progress" value={`${(metrics.bestProgress * 100).toFixed(1)}%`} />
      <Metric label="Clear rate" value={`${(metrics.completionRate * 100).toFixed(0)}%`} />
      <Metric label="Avg reward" value={metrics.averageReward.toFixed(1)} />
      <Metric label="Epsilon" value={metrics.epsilon.toFixed(3)} />
      <Metric label="States seen" value={compact(metrics.stateCount)} />
      <Metric label="Steps/sec" value={compact(metrics.stepsPerSecond)} />
    </div>
  );
}
