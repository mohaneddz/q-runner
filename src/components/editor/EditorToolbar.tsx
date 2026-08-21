"use client";

import {
  Download,
  Eraser,
  FilePlus2,
  MousePointer2,
  PlusSquare,
  Play,
  Redo2,
  Save,
  ShieldCheck,
  Undo2,
  Upload,
} from "lucide-react";
import { SNAP_SIZES } from "@/game/editor/grid";
import { useEditorStore, type EditorTool } from "@/game/editor/editorStore";

const TOOLS: { id: EditorTool; label: string; Icon: typeof MousePointer2 }[] = [
  { id: "select", label: "Select", Icon: MousePointer2 },
  { id: "place", label: "Place", Icon: PlusSquare },
  { id: "erase", label: "Erase", Icon: Eraser },
];

interface EditorToolbarProps {
  onNew: () => void;
  onSave: () => void;
  onExport: () => void;
  onImport: () => void;
  onPlaytest: () => void;
  onValidate: () => void;
  validating: boolean;
  saving: boolean;
}

export function EditorToolbar({
  onNew,
  onSave,
  onExport,
  onImport,
  onPlaytest,
  onValidate,
  validating,
  saving,
}: EditorToolbarProps) {
  const tool = useEditorStore((state) => state.tool);
  const setTool = useEditorStore((state) => state.setTool);
  const snap = useEditorStore((state) => state.snap);
  const setSnap = useEditorStore((state) => state.setSnap);
  const undo = useEditorStore((state) => state.undo);
  const redo = useEditorStore((state) => state.redo);
  const canUndo = useEditorStore((state) => state.past.length > 0);
  const canRedo = useEditorStore((state) => state.future.length > 0);

  return (
    <div className="panel pad toolRow">
      <div className="toolRowActions">
        {TOOLS.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            className={`btn btnSmall ${tool === id ? "btnPrimary" : ""}`}
            aria-pressed={tool === id}
            onClick={() => setTool(id)}
          >
            <Icon size={15} aria-hidden />
            {label}
          </button>
        ))}

        <label className="field" style={{ minWidth: 92 }}>
          Snap
          <select
            value={snap}
            onChange={(event) =>
              setSnap(Number(event.target.value) as (typeof SNAP_SIZES)[number])
            }
          >
            {SNAP_SIZES.map((size) => (
              <option key={size} value={size}>
                {size} unit{size === 1 ? "" : "s"}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          className="btn btnSmall"
          onClick={undo}
          disabled={!canUndo}
          title="Undo (Ctrl+Z)"
        >
          <Undo2 size={15} aria-hidden />
          Undo
        </button>
        <button
          type="button"
          className="btn btnSmall"
          onClick={redo}
          disabled={!canRedo}
          title="Redo (Ctrl+Shift+Z)"
        >
          <Redo2 size={15} aria-hidden />
          Redo
        </button>
      </div>

      <div className="toolRowActions">
        <button type="button" className="btn btnSmall" onClick={onNew}>
          <FilePlus2 size={15} aria-hidden />
          New
        </button>
        <button type="button" className="btn btnSmall" onClick={onImport}>
          <Upload size={15} aria-hidden />
          Import
        </button>
        <button type="button" className="btn btnSmall" onClick={onExport}>
          <Download size={15} aria-hidden />
          Export
        </button>
        <button
          type="button"
          className="btn btnSmall"
          onClick={onValidate}
          disabled={validating}
        >
          <ShieldCheck size={15} aria-hidden />
          {validating ? "Checking…" : "Check"}
        </button>
        <button type="button" className="btn btnSmall" onClick={onSave} disabled={saving}>
          <Save size={15} aria-hidden />
          {saving ? "Saving…" : "Save"}
        </button>
        <button type="button" className="btn btnSmall btnPrimary" onClick={onPlaytest}>
          <Play size={15} aria-hidden />
          Playtest
        </button>
      </div>
    </div>
  );
}
