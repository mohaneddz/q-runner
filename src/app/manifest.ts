import type { MetadataRoute } from "next";
import { SITE_DESCRIPTION, SITE_NAME, THEME_COLOR } from "@/app/siteConfig";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${SITE_NAME} — a precision auto-runner`,
    short_name: SITE_NAME,
    description: SITE_DESCRIPTION,
    start_url: "/",
    display: "standalone",
    // The game is a 16:9 canvas and reads badly in portrait on a phone.
    orientation: "landscape",
    background_color: THEME_COLOR,
    theme_color: THEME_COLOR,
    icons: [
      { src: "/icons/icon192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}
