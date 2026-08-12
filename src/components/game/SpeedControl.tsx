interface SpeedControlProps {
  value: number;
  onChange: (speed: number) => void;
}

export function SpeedControl({ value, onChange }: SpeedControlProps) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <span>Speed</span>
      <input
        type="range"
        min={1}
        max={32}
        step={1}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <strong>{value}x</strong>
    </label>
  );
}
