import type { Snapshot } from "@/game/core/types";

interface GameHudProps {
  snapshot: Snapshot | null;
  mode: "human" | "agent";
  attempts: number;
  onModeChange: (mode: "human" | "agent") => void;
}

export function GameHud({ snapshot, mode, attempts, onModeChange }: GameHudProps) {
  return (
    <div className="panel" style={{ padding: 12, display: "flex", gap: 16, flexWrap: "wrap" }}>
      <strong>Mode</strong>
      <select value={mode} onChange={(event) => onModeChange(event.target.value as "human" | "agent")}>
        <option value="human">Human</option>
        <option value="agent">System Agent</option>
      </select>
      <span>Attempts: {attempts}</span>
      <span>Progress: {snapshot ? `${(snapshot.progress * 100).toFixed(1)}%` : "0%"}</span>
      <span>Reward: {snapshot ? snapshot.totalReward.toFixed(1) : "0.0"}</span>
      <span>Obs Dist: {snapshot ? snapshot.observation.distanceToNextObstacle.toFixed(0) : "-"}</span>
      <span>Vy: {snapshot ? snapshot.observation.verticalVelocity.toFixed(0) : "-"}</span>
    </div>
  );
}
