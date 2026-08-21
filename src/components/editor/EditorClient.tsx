"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { EditorCanvas } from "@/components/editor/EditorCanvas";
import { EditorPalette } from "@/components/editor/EditorPalette";
import { EditorToolbar } from "@/components/editor/EditorToolbar";
import { Inspector } from "@/components/editor/Inspector";
import { SiteNav } from "@/components/ui/SiteNav";
import { createBlankLevel, useEditorStore } from "@/game/editor/editorStore";
import { isBuiltinLevel, loadBuiltinLevel } from "@/game/level/builtinLevels";
import { duplicateLevel, loadSavedLevel, saveLevel } from "@/game/level/levelStore";
import { deserializeLevel, LevelParseError, serializeLevel } from "@/game/level/levelSerializer";
import { solveLevelAsync } from "@/game/validation/solverClient";

type Status =
  | { kind: "idle" }
  | { kind: "info"; message: string }
  | { kind: "ok"; message: string }
  | { kind: "error"; message: string };

export function EditorClient({ levelId }: { levelId?: string }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const level = useEditorStore((state) => state.level);
  const loadLevel = useEditorStore((state) => state.loadLevel);
  const objectCount = useEditorStore((state) => state.level.objects.length);

  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [validating, setValidating] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!levelId) {
      return;
    }
    let cancelled = false;

    void (async () => {
      const saved = await loadSavedLevel(levelId);
      if (cancelled) {
        return;
      }
      if (saved) {
        loadLevel(saved);
        setStatus({ kind: "info", message: `Opened “${saved.meta.name}”.` });
        return;
      }

      if (!isBuiltinLevel(levelId)) {
        setStatus({ kind: "error", message: `No level stored under “${levelId}”.` });
        return;
      }

      // Saving would write back under the built-in's own id and shadow it
      // permanently, so a built-in opens as a copy.
      const builtin = await loadBuiltinLevel(levelId);
      if (cancelled || !builtin) {
        return;
      }
      const copy = duplicateLevel(builtin, `${builtin.meta.name} remix`);
      loadLevel(copy);
      setStatus({
        kind: "info",
        message: `Opened a copy of “${builtin.meta.name}”. The original is untouched.`,
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [levelId, loadLevel]);

  const finishGates = level.objects.filter((object) => object.type === "finishGate").length;

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveLevel(level);
      setStatus({ kind: "ok", message: `Saved “${level.meta.name}”.` });
    } catch {
      setStatus({ kind: "error", message: "Could not save. Browser storage may be full." });
    } finally {
      setSaving(false);
    }
  };

  const handleExport = () => {
    const blob = new Blob([serializeLevel(level)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${level.meta.id}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = async (file: File) => {
    try {
      loadLevel(deserializeLevel(await file.text()));
      setStatus({ kind: "ok", message: "Imported." });
    } catch (error) {
      setStatus({
        kind: "error",
        message:
          error instanceof LevelParseError ? error.message : "That file could not be read.",
      });
    }
  };

  const handleValidate = async () => {
    if (finishGates !== 1) {
      setStatus({
        kind: "error",
        message: `A level needs exactly one finish gate — this has ${finishGates}.`,
      });
      return;
    }

    setValidating(true);
    setStatus({ kind: "info", message: "Simulating every way through the level…" });
    try {
      const result = await solveLevelAsync(level);
      setStatus(
        result.solvable
          ? { kind: "ok", message: `Clearable — solved in ${result.ticksSurvived} ticks.` }
          : {
              kind: "error",
              message: `No route through. The solver gets stuck around x=${result.reachedX.toFixed(1)}.`,
            },
      );
    } catch (error) {
      setStatus({
        kind: "error",
        message: error instanceof Error ? error.message : "The check failed.",
      });
    } finally {
      setValidating(false);
    }
  };

  const handlePlaytest = async () => {
    await saveLevel(level);
    router.push(`/play?level=${level.meta.id}`);
  };

  return (
    <main className="appShell stack">
      <SiteNav />

      <div className="sectionHead">
        <h1>Editor</h1>
        <span className="muted small">
          {objectCount} objects · {level.settings.length.toFixed(0)} units
        </span>
      </div>

      <EditorToolbar
        onNew={() => {
          loadLevel(createBlankLevel());
          setStatus({ kind: "info", message: "Started a new level." });
        }}
        onSave={() => void handleSave()}
        onExport={handleExport}
        onImport={() => fileInputRef.current?.click()}
        onPlaytest={() => void handlePlaytest()}
        onValidate={() => void handleValidate()}
        validating={validating}
        saving={saving}
      />

      {status.kind !== "idle" ? (
        <p
          className={`small ${
            status.kind === "ok"
              ? "validationOk"
              : status.kind === "error"
                ? "validationBad"
                : "muted"
          }`}
          role="status"
        >
          {status.message}
        </p>
      ) : null}

      <div className="editorLayout">
        <EditorCanvas />
        <div className="editorSidebar">
          <Inspector />
          <EditorPalette />
        </div>
      </div>

      <p className="muted small">
        Drag to pan with middle-click or space · scroll to zoom · shift-click to multi-select ·
        <kbd>Ctrl</kbd>+<kbd>Z</kbd> undo · <kbd>Ctrl</kbd>+<kbd>D</kbd> duplicate ·{" "}
        <kbd>Delete</kbd> remove
      </p>

      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            void handleImportFile(file);
          }
          // Reset so re-picking the same file fires change again.
          event.target.value = "";
        }}
      />
    </main>
  );
}
