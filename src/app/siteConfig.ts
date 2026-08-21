export const SITE_NAME = "Q-Runner";

export const SITE_DESCRIPTION =
  "A deterministic browser auto-runner with cube, ship and ball modes, a level editor, " +
  "endless mode and an in-browser Q-learning agent. Every level is proven clearable before it ships.";

/**
 * Absolute origin used for canonical URLs, the sitemap and social card links.
 * Set NEXT_PUBLIC_SITE_URL for a deployment; the fallback keeps local builds
 * producing valid absolute URLs rather than throwing.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
).replace(/\/$/, "");

export const THEME_COLOR = "#05070f";
