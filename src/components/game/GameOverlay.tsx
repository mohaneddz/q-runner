import type { Snapshot } from "@/game/core/types";

interface GameOverlayProps {
  snapshot: Snapshot | null;
}

export function GameOverlay({ snapshot }: GameOverlayProps) {
  if (!snapshot || snapshot.status !== "finished") {
    return null;
  }

  return (
    <div
      className="panel"
      style={{ position: "absolute", top: 24, right: 24, padding: 12, borderColor: "rgba(129,255,111,0.7)" }}
    >
      Level finished
    </div>
  );
}
