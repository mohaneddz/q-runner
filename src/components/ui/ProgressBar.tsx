interface ProgressBarProps {
  /** Current run, 0-1. */
  value: number;
  /** Best ever reached, drawn as a marker so a run has something to beat. */
  best?: number;
  label?: string;
}

export function ProgressBar({ value, best, label }: ProgressBarProps) {
  const percent = Math.round(Math.max(0, Math.min(1, value)) * 100);
  const bestPercent = best === undefined ? null : Math.round(Math.max(0, Math.min(1, best)) * 100);

  return (
    <div className="progressWrap">
      <div
        className="progressTrack"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label ?? "Level progress"}
      >
        <div className="progressFill" style={{ width: `${percent}%` }} />
        {bestPercent !== null && bestPercent > 0 ? (
          <div className="progressBest" style={{ left: `${bestPercent}%` }} />
        ) : null}
      </div>
      <span className="progressValue">
        {percent}%
        {bestPercent !== null && bestPercent > percent ? (
          <span className="muted"> · best {bestPercent}%</span>
        ) : null}
      </span>
    </div>
  );
}
