"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { EditorCanvas } from "@/components/editor/EditorCanvas";
import { Inspector } from "@/components/editor/Inspector";
import { EditorToolbar } from "@/components/editor/EditorToolbar";
import {
  addObject,
  createEditorState,
  getObjectById,
  moveObject,
  removeObject,
  updateObject,
} from "@/game/editor/editorStore";
import { createBlankLevel } from "@/game/level/levelLoader";
import { exportLevel, importLevel, saveLevel } from "@/game/level/levelStore";

const EDITOR_DRAFT_ID = "editor-draft";

export default function EditorPage() {
  const router = useRouter();
  const [state, setState] = useState(() => createEditorState(createBlankLevel()));

  const selectedObject = useMemo(
    () => getObjectById(state.level, state.selectedId),
    [state.level, state.selectedId],
  );

  const saveDraft = async () => {
    await saveLevel({ ...state.level, id: EDITOR_DRAFT_ID, name: "Editor Draft" });
  };

  const exportJson = () => {
    const raw = exportLevel(state.level);
    const blob = new Blob([raw], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${state.level.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importJson = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) {
        return;
      }
      const raw = await file.text();
      try {
        const level = importLevel(raw);
        setState(createEditorState(level));
      } catch {
        alert("Invalid level JSON");
      }
    };
    input.click();
  };

  const playtest = async () => {
    await saveDraft();
    router.push(`/play?level=${EDITOR_DRAFT_ID}`);
  };

  return (
    <main className="app-shell" style={{ padding: "20px 0", display: "grid", gap: 12 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "center", justifyContent: "space-between" }}>
        <h1 style={{ margin: 0 }}>Level Editor</h1>
        <div style={{ display: "flex", gap: 10 }}>
          <Link href="/" className="btn">Home</Link>
          <Link href="/play" className="btn">Play</Link>
          <Link href="/training" className="btn">Training</Link>
        </div>
      </div>

      <EditorToolbar
        tool={state.tool}
        placeType={state.placeType}
        onToolChange={(tool) => setState((prev) => ({ ...prev, tool }))}
        onPlaceTypeChange={(placeType) => setState((prev) => ({ ...prev, placeType }))}
        onSave={() => void saveDraft()}
        onExport={exportJson}
        onImport={importJson}
        onPlaytest={() => void playtest()}
      />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 12 }}>
        <EditorCanvas
          level={state.level}
          tool={state.tool}
          placeType={state.placeType}
          selectedId={state.selectedId}
          onSelect={(id) => setState((prev) => ({ ...prev, selectedId: id }))}
          onPlace={(x, y) => setState((prev) => addObject(prev, x, y))}
          onDelete={(id) => setState((prev) => removeObject(prev, id))}
          onMove={(id, x, y) => setState((prev) => moveObject(prev, id, x, y))}
        />

        <Inspector
          object={selectedObject}
          onChange={(object) => setState((prev) => updateObject(prev, object))}
          onDelete={(id) => setState((prev) => removeObject(prev, id))}
        />
      </div>
    </main>
  );
}
