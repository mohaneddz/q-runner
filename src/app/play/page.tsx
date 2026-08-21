import type { Metadata } from "next";
import { PlayClient } from "@/components/game/PlayClient";
import { summaryFor } from "@/game/level/builtinLevels";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function readLevelId(params: Record<string, string | string[] | undefined>): string | undefined {
  const raw = params.level;
  return typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : undefined;
}

/**
 * Each built-in level is a distinct, linkable page, so it gets its own title,
 * description and canonical rather than ten copies of a generic "Play".
 */
export async function generateMetadata({
  searchParams,
}: {
  searchParams: SearchParams;
}): Promise<Metadata> {
  const levelId = readLevelId(await searchParams);
  const summary = levelId ? summaryFor(levelId) : null;

  if (!summary) {
    return {
      title: "Play",
      description: "Run a Q-Runner level. Hold to jump, fly or flip depending on the mode.",
      alternates: { canonical: "/play" },
    };
  }

  const modes = summary.modes.join(", ");
  const description =
    `Level ${summary.tier} of Q-Runner. ${summary.length.toFixed(0)} units at speed ` +
    `${summary.baseSpeed}, playing as ${modes}` +
    `${summary.hasGravityFlips ? ", with gravity flips" : ""}.`;

  return {
    title: summary.name,
    description,
    alternates: { canonical: `/play?level=${summary.id}` },
    openGraph: { title: `${summary.name} · Q-Runner`, description },
  };
}

export default async function PlayPage({ searchParams }: { searchParams: SearchParams }) {
  return <PlayClient levelId={readLevelId(await searchParams)} />;
}
