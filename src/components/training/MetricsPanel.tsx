interface MetricsPanelProps {
  episode: number;
  episodeReward: number;
  averageReward: number;
  epsilon: number;
}

export function MetricsPanel({ episode, episodeReward, averageReward, epsilon }: MetricsPanelProps) {
  return (
    <div className="panel" style={{ padding: 12, display: "grid", gap: 6 }}>
      <strong>Training Metrics</strong>
      <span>Episode: {episode}</span>
      <span>Episode Reward: {episodeReward.toFixed(2)}</span>
      <span>Average Reward (100): {averageReward.toFixed(2)}</span>
      <span>Epsilon: {epsilon.toFixed(3)}</span>
    </div>
  );
}
