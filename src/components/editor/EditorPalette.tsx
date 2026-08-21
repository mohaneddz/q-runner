"use client";

import { useEditorStore } from "@/game/editor/editorStore";
import {
  OBJECT_CATALOG,
  OBJECT_TYPES_BY_CATEGORY,
  type ObjectCategory,
} from "@/game/level/objectCatalog";

const GROUP_LABELS: Record<ObjectCategory, string> = {
  solid: "Platforms",
  hazard: "Hazards",
  pad: "Pads",
  orb: "Orbs",
  portal: "Portals",
  goal: "Goal",
};

const GROUP_ORDER: ObjectCategory[] = ["solid", "hazard", "pad", "orb", "portal", "goal"];

export function EditorPalette() {
  const placeType = useEditorStore((state) => state.placeType);
  const setPlaceType = useEditorStore((state) => state.setPlaceType);
  const setTool = useEditorStore((state) => state.setTool);

  return (
    <div className="panel pad">
      <h2>Palette</h2>
      {GROUP_ORDER.map((category) => (
        <div key={category}>
          <p className="paletteGroup">{GROUP_LABELS[category]}</p>
          <div className="paletteGrid">
            {OBJECT_TYPES_BY_CATEGORY[category].map((type) => (
              <button
                key={type}
                type="button"
                className={`paletteItem ${placeType === type ? "paletteItemActive" : ""}`}
                aria-pressed={placeType === type}
                onClick={() => {
                  setPlaceType(type);
                  // Picking from the palette implies you want to place it.
                  setTool("place");
                }}
              >
                {OBJECT_CATALOG[type].label}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
