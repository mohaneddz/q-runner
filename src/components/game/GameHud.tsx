"use client";

import type { Snapshot } from "@/game/core/types";
import type { LevelData } from "@/game/level/levelSchema";
import { MuteButton } from "@/components/ui/MuteButton";
import { ProgressBar } from "@/components/ui/ProgressBar";

interface GameHudProps {
  level: LevelData;
  snapshot: Snapshot | null;
  attempts: number;
  bestProgress: number;
}

const MODE_LABELS = {
  cube: "Cube",
  ship: "Ship",
  ball: "Ball",
} as const;

export function GameHud({ level, snapshot, attempts, bestProgress }: GameHudProps) {
  const progress = snapshot?.progress ?? 0;
  const mode = snapshot?.player.mode ?? level.settings.startMode;
  const flipped = (snapshot?.player.gravity ?? level.settings.startGravity) === -1;

  return (
    <div className="panel hud">
      <div className="hudRow">
        <div className="hudTitle">
          <h1 className="hudHeading">{level.meta.name}</h1>
          <span className="muted">by {level.meta.author}</span>
        </div>
        <div className="hudStats">
          <span className={`badge badge${MODE_LABELS[mode]}`}>{MODE_LABELS[mode]}</span>
          {flipped ? <span className="badge badgeFlip">Gravity flipped</span> : null}
          <span className="muted">Attempt {attempts}</span>
          <MuteButton />
        </div>
      </div>
      <ProgressBar value={progress} best={bestProgress} />
    </div>
  );
}
