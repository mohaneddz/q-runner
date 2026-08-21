"use client";

import type { ReactNode } from "react";

interface GameOverlayProps {
  title: string;
  detail?: ReactNode;
  actions?: ReactNode;
  tone?: "win" | "neutral";
}

export function GameOverlay({ title, detail, actions, tone = "neutral" }: GameOverlayProps) {
  return (
    <div className="overlay">
      <div className={`panel overlayCard ${tone === "win" ? "overlayWin" : ""}`}>
        <h2 className="overlayTitle">{title}</h2>
        {detail ? <div className="overlayDetail">{detail}</div> : null}
        {actions ? <div className="overlayActions">{actions}</div> : null}
      </div>
    </div>
  );
}
