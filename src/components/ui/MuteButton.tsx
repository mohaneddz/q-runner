"use client";

import { Volume2, VolumeX } from "lucide-react";
import { useSyncExternalStore } from "react";
import { audio } from "@/game/audio/audioManager";

export function MuteButton() {
  // The preference lives in localStorage, which the server render cannot see.
  // Reporting "not muted" as the server snapshot keeps hydration consistent.
  const muted = useSyncExternalStore(audio.subscribe, audio.isMuted, () => false);

  return (
    <button
      type="button"
      className="btn btnIcon"
      aria-pressed={muted}
      aria-label={muted ? "Unmute" : "Mute"}
      title={muted ? "Unmute" : "Mute"}
      onClick={() => {
        audio.unlock();
        audio.setMuted(!muted);
      }}
    >
      {muted ? <VolumeX size={16} aria-hidden /> : <Volume2 size={16} aria-hidden />}
    </button>
  );
}
