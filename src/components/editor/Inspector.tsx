import type { LevelObject } from "@/game/level/levelTypes";

interface InspectorProps {
  object: LevelObject | null;
  onChange: (object: LevelObject) => void;
  onDelete: (id: string) => void;
}

export function Inspector({ object, onChange, onDelete }: InspectorProps) {
  if (!object) {
    return (
      <aside className="panel" style={{ padding: 12 }}>
        <strong>Inspector</strong>
        <p style={{ color: "var(--muted)" }}>Select an object to edit.</p>
      </aside>
    );
  }

  return (
    <aside className="panel" style={{ padding: 12, display: "grid", gap: 8 }}>
      <strong>Inspector</strong>
      <label>
        X
        <input
          className="input"
          type="number"
          value={object.x}
          onChange={(event) => onChange({ ...object, x: Number(event.target.value) })}
        />
      </label>
      <label>
        Y
        <input
          className="input"
          type="number"
          value={object.y}
          onChange={(event) => onChange({ ...object, y: Number(event.target.value) })}
        />
      </label>
      <label>
        Width
        <input
          className="input"
          type="number"
          value={object.width}
          onChange={(event) => onChange({ ...object, width: Number(event.target.value) })}
        />
      </label>
      <label>
        Height
        <input
          className="input"
          type="number"
          value={object.height}
          onChange={(event) => onChange({ ...object, height: Number(event.target.value) })}
        />
      </label>
      <button className="btn btn-danger" onClick={() => onDelete(object.id)}>
        Delete
      </button>
    </aside>
  );
}
