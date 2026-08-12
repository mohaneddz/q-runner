"use client";

import Link from "next/link";
import { useState } from "react";
import { GameCanvas } from "@/components/game/GameCanvas";
import { GameHud } from "@/components/game/GameHud";
import { GameOverlay } from "@/components/game/GameOverlay";
import type { Snapshot } from "@/game/core/types";

interface PlayClientProps {
  levelId?: string;
}

export function PlayClient({ levelId }: PlayClientProps) {
  const [mode, setMode] = useState<"human" | "agent">("human");
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [attempts, setAttempts] = useState(1);

  return (
    <main className="app-shell" style={{ padding: "20px 0", display: "grid", gap: 12 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "center", justifyContent: "space-between" }}>
        <h1 style={{ margin: 0 }}>Play</h1>
        <div style={{ display: "flex", gap: 10 }}>
          <Link href="/" className="btn">Home</Link>
          <Link href="/editor" className="btn">Editor</Link>
          <Link href="/training" className="btn">Training</Link>
        </div>
      </div>

      <GameHud snapshot={snapshot} mode={mode} attempts={attempts} onModeChange={setMode} />

      <div style={{ position: "relative" }}>
        <GameCanvas
          mode={mode}
          levelId={levelId}
          onSnapshot={setSnapshot}
          onDeath={() => setAttempts((value) => value + 1)}
        />
        <GameOverlay snapshot={snapshot} />
      </div>
    </main>
  );
}
