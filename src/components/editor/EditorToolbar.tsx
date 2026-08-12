import type { EditorTool } from "@/game/editor/editorStore";
import type { LevelObjectType } from "@/game/level/levelTypes";

interface EditorToolbarProps {
  tool: EditorTool;
  placeType: LevelObjectType;
  onToolChange: (tool: EditorTool) => void;
  onPlaceTypeChange: (type: LevelObjectType) => void;
  onSave: () => void;
  onExport: () => void;
  onImport: () => void;
  onPlaytest: () => void;
}

export function EditorToolbar({
  tool,
  placeType,
  onToolChange,
  onPlaceTypeChange,
  onSave,
  onExport,
  onImport,
  onPlaytest,
}: EditorToolbarProps) {
  return (
    <div className="panel" style={{ padding: 12, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
      <span>Tool</span>
      <select value={tool} onChange={(event) => onToolChange(event.target.value as EditorTool)}>
        <option value="place">Place</option>
        <option value="delete">Delete</option>
        <option value="drag">Drag</option>
      </select>
      <span>Object</span>
      <select value={placeType} onChange={(event) => onPlaceTypeChange(event.target.value as LevelObjectType)}>
        <option value="platform">Platform</option>
        <option value="spike">Spike</option>
      </select>
      <button className="btn" onClick={onSave}>Save</button>
      <button className="btn" onClick={onExport}>Export JSON</button>
      <button className="btn" onClick={onImport}>Import JSON</button>
      <button className="btn" onClick={onPlaytest}>Playtest</button>
    </div>
  );
}
