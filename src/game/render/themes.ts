export const THEME_IDS = ["neon", "sunset", "void", "circuit", "ember"] as const;

export type ThemeId = (typeof THEME_IDS)[number];

export interface Theme {
  id: ThemeId;
  label: string;
  skyTop: string;
  skyBottom: string;
  grid: string;
  solidFill: string;
  solidEdge: string;
  hazard: string;
  hazardEdge: string;
  accent: string;
  player: string;
  playerEdge: string;
  glow: string;
}

export const THEMES: Record<ThemeId, Theme> = {
  neon: {
    id: "neon",
    label: "Neon",
    skyTop: "#0b1328",
    skyBottom: "#05070f",
    grid: "rgba(32, 241, 255, 0.09)",
    solidFill: "#132b4d",
    solidEdge: "#16d3ff",
    hazard: "#ff4dbf",
    hazardEdge: "#ffa8e2",
    accent: "#81ff6f",
    player: "#f4fbff",
    playerEdge: "#20f1ff",
    glow: "rgba(32, 241, 255, 0.35)",
  },
  sunset: {
    id: "sunset",
    label: "Sunset",
    skyTop: "#2a1136",
    skyBottom: "#0d0512",
    grid: "rgba(255, 176, 102, 0.09)",
    solidFill: "#43204a",
    solidEdge: "#ff9f5a",
    hazard: "#ff5470",
    hazardEdge: "#ffc0c9",
    accent: "#ffd166",
    player: "#fff4e6",
    playerEdge: "#ff9f5a",
    glow: "rgba(255, 159, 90, 0.32)",
  },
  void: {
    id: "void",
    label: "Void",
    skyTop: "#101018",
    skyBottom: "#030305",
    grid: "rgba(190, 190, 220, 0.07)",
    solidFill: "#1d1d2c",
    solidEdge: "#8f8fb8",
    hazard: "#d6d6ff",
    hazardEdge: "#ffffff",
    accent: "#7af5d0",
    player: "#ffffff",
    playerEdge: "#8f8fb8",
    glow: "rgba(160, 160, 200, 0.25)",
  },
  circuit: {
    id: "circuit",
    label: "Circuit",
    skyTop: "#04160f",
    skyBottom: "#010806",
    grid: "rgba(60, 255, 170, 0.08)",
    solidFill: "#0d3326",
    solidEdge: "#3cffaa",
    hazard: "#ffe14d",
    hazardEdge: "#fff5b0",
    accent: "#3cffaa",
    player: "#eafff6",
    playerEdge: "#3cffaa",
    glow: "rgba(60, 255, 170, 0.3)",
  },
  ember: {
    id: "ember",
    label: "Ember",
    skyTop: "#1e0a07",
    skyBottom: "#0a0302",
    grid: "rgba(255, 122, 69, 0.08)",
    solidFill: "#3a1710",
    solidEdge: "#ff7a45",
    hazard: "#ffd166",
    hazardEdge: "#fff0c2",
    accent: "#ff7a45",
    player: "#fff1e8",
    playerEdge: "#ff7a45",
    glow: "rgba(255, 122, 69, 0.32)",
  },
};

export function isThemeId(value: string): value is ThemeId {
  return (THEME_IDS as readonly string[]).includes(value);
}

/** Tolerates unknown ids so an imported level never fails to render. */
export function resolveTheme(id: string): Theme {
  return isThemeId(id) ? THEMES[id] : THEMES.neon;
}
