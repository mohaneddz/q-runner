"use client";

import { useEditorStore } from "@/game/editor/editorStore";
import { definitionFor } from "@/game/level/objectCatalog";
import { THEME_IDS, THEMES } from "@/game/render/themes";

function NumberField({
  label,
  value,
  step = 1,
  min,
  onChange,
}: {
  label: string;
  value: number;
  step?: number;
  min?: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="field">
      {label}
      <input
        className="input"
        type="number"
        value={value}
        step={step}
        min={min}
        onChange={(event) => {
          const next = Number(event.target.value);
          if (Number.isFinite(next)) {
            onChange(next);
          }
        }}
      />
    </label>
  );
}

export function Inspector() {
  const level = useEditorStore((state) => state.level);
  const selectedIds = useEditorStore((state) => state.selectedIds);
  const updateObject = useEditorStore((state) => state.updateObject);
  const updateSettings = useEditorStore((state) => state.updateSettings);
  const rename = useEditorStore((state) => state.rename);
  const deleteSelected = useEditorStore((state) => state.deleteSelected);
  const duplicateSelected = useEditorStore((state) => state.duplicateSelected);

  const selected =
    selectedIds.length === 1
      ? (level.objects.find((object) => object.id === selectedIds[0]) ?? null)
      : null;
  const definition = selected ? definitionFor(selected.type) : null;

  return (
    <div className="panel pad stack">
      <h2>Inspector</h2>

      {selectedIds.length > 1 ? (
        <>
          <p className="muted small">{selectedIds.length} objects selected.</p>
          <div className="toolRowActions">
            <button type="button" className="btn btnSmall" onClick={duplicateSelected}>
              Duplicate
            </button>
            <button type="button" className="btn btnSmall btnDanger" onClick={deleteSelected}>
              Delete
            </button>
          </div>
        </>
      ) : selected && definition ? (
        <>
          <p className="muted small">{definition.label}</p>
          <div className="fieldGrid">
            <NumberField
              label="X"
              value={selected.x}
              step={0.25}
              onChange={(x) => updateObject({ ...selected, x })}
            />
            <NumberField
              label="Y"
              value={selected.y}
              step={0.25}
              onChange={(y) => updateObject({ ...selected, y })}
            />
            <NumberField
              label="Width"
              value={selected.width ?? definition.width}
              step={definition.resizable ? 1 : 0.25}
              min={0.25}
              onChange={(width) => updateObject({ ...selected, width })}
            />
            <NumberField
              label="Height"
              value={selected.height ?? definition.height}
              step={definition.resizable ? 1 : 0.25}
              min={0.25}
              onChange={(height) => updateObject({ ...selected, height })}
            />
          </div>
          {definition.resizable ? null : (
            <p className="muted small">
              Resizing this changes its hitbox — the solver validates whatever you set.
            </p>
          )}
          <div className="toolRowActions">
            <button type="button" className="btn btnSmall" onClick={duplicateSelected}>
              Duplicate
            </button>
            <button type="button" className="btn btnSmall btnDanger" onClick={deleteSelected}>
              Delete
            </button>
          </div>
        </>
      ) : (
        <p className="muted small">Select an object to edit it.</p>
      )}

      <hr style={{ border: 0, borderTop: "1px solid var(--border)" }} />

      <h2>Level</h2>
      <label className="field">
        Name
        <input
          className="input"
          value={level.meta.name}
          onChange={(event) => rename(event.target.value)}
        />
      </label>

      <div className="fieldGrid">
        <NumberField
          label="Length"
          value={level.settings.length}
          min={20}
          onChange={(length) => updateSettings({ length })}
        />
        <NumberField
          label="Speed"
          value={level.settings.baseSpeed}
          step={0.2}
          min={1}
          onChange={(baseSpeed) => updateSettings({ baseSpeed })}
        />
      </div>

      <label className="field">
        Start mode
        <select
          value={level.settings.startMode}
          onChange={(event) =>
            updateSettings({ startMode: event.target.value as "cube" | "ship" | "ball" })
          }
        >
          <option value="cube">Cube</option>
          <option value="ship">Ship</option>
          <option value="ball">Ball</option>
        </select>
      </label>

      <label className="field">
        Start gravity
        <select
          value={String(level.settings.startGravity)}
          onChange={(event) =>
            updateSettings({ startGravity: Number(event.target.value) === -1 ? -1 : 1 })
          }
        >
          <option value="1">Normal</option>
          <option value="-1">Flipped</option>
        </select>
      </label>

      <label className="field">
        Theme
        <select
          value={level.settings.theme}
          onChange={(event) =>
            updateSettings({ theme: event.target.value as (typeof THEME_IDS)[number] })
          }
        >
          {THEME_IDS.map((id) => (
            <option key={id} value={id}>
              {THEMES[id].label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
