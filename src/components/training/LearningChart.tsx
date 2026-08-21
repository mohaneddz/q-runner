interface Series {
  label: string;
  color: string;
  /** Values in 0-1. */
  points: number[];
}

interface LearningChartProps {
  series: Series[];
}

const WIDTH = 600;
const HEIGHT = 160;
const PADDING = 8;

function pathFor(points: number[]): string {
  if (points.length < 2) {
    return "";
  }
  const stepX = (WIDTH - PADDING * 2) / (points.length - 1);
  const usable = HEIGHT - PADDING * 2;

  return points
    .map((value, index) => {
      const x = PADDING + index * stepX;
      const y = PADDING + (1 - Math.max(0, Math.min(1, value))) * usable;
      return `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
}

/**
 * Plain SVG rather than a charting dependency — two normalised series over a
 * fixed 0-1 range does not justify one.
 */
export function LearningChart({ series }: LearningChartProps) {
  const hasData = series.some((entry) => entry.points.length > 1);

  return (
    <div className="panel pad stack">
      <div className="sectionHead">
        <h2>Learning curve</h2>
        <div className="toolRowActions">
          {series.map((entry) => (
            <span key={entry.label} className="muted small">
              <span
                aria-hidden
                style={{
                  display: "inline-block",
                  width: 10,
                  height: 3,
                  background: entry.color,
                  marginRight: 6,
                  verticalAlign: "middle",
                }}
              />
              {entry.label}
            </span>
          ))}
        </div>
      </div>

      {hasData ? (
        <svg
          className="chart"
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          preserveAspectRatio="none"
          role="img"
          aria-label="Training progress over time"
        >
          {[0.25, 0.5, 0.75].map((line) => (
            <line
              key={line}
              x1={PADDING}
              x2={WIDTH - PADDING}
              y1={PADDING + (1 - line) * (HEIGHT - PADDING * 2)}
              y2={PADDING + (1 - line) * (HEIGHT - PADDING * 2)}
              stroke="rgba(255,255,255,0.08)"
              strokeWidth={1}
            />
          ))}
          {series.map((entry) => (
            <path
              key={entry.label}
              d={pathFor(entry.points)}
              fill="none"
              stroke={entry.color}
              strokeWidth={2}
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </svg>
      ) : (
        <p className="muted small">Start training to see the curve.</p>
      )}
    </div>
  );
}
